import { periodRange, type Timeline } from '../core/calendar';
import { BP_PER_UNIT, monthlyInterest, MONTHS_PER_YEAR, roundCents } from '../core/money';
import { at, sumRange } from '../core/series';
import type {
  Bp,
  Cents,
  CreditLine,
  FinancingInput,
  FinancingLine,
  LoanLine,
  MonthIndex,
  RepaymentType,
} from '../types/input';
import type { LoanSchedule, PeriodDebtSummary, ScheduleRow } from '../types/result';

export interface LoanTerms {
  principalCents: Cents;
  annualRateBp: Bp;
  /** Inclusief aflossingsvrije periode. */
  termMonths: number;
  graceMonths: number;
  repayment: RepaymentType;
  startMonth: MonthIndex;
  /** false: de lening loopt al en staat met dit saldo op de openingsbalans. */
  isNew: boolean;
}

export function isCreditLine(line: FinancingLine): line is CreditLine {
  return line.kind === 'krediet';
}

export function isLoanLine(line: FinancingLine): line is LoanLine {
  return line.kind !== 'krediet';
}

/** A = P · r / (1 − (1 + r)^−n), met r de maandrente. */
export function annuityPayment(principalCents: Cents, annualRateBp: Bp, months: number): Cents {
  if (annualRateBp === 0) return roundCents(principalCents / months);
  const rate = annualRateBp / (BP_PER_UNIT * MONTHS_PER_YEAR);
  return roundCents((principalCents * rate) / (1 - (1 + rate) ** -months));
}

/**
 * Aflossingsschema over de horizon. Rente per maand afgerond op centen; de laatste termijn
 * lost het restant af, zodat het saldo exact op 0 eindigt. Tijdens de aflossingsvrije periode
 * alleen rente; daarna wordt over de resterende maanden afgelost. Is de aflossingsvrije
 * periode even lang als de looptijd, dan volgt alles als slottermijn.
 */
export function buildSchedule(
  terms: LoanTerms,
  length: number,
): { rows: ScheduleRow[]; annuityPayment: Cents | null; linearPrincipal: Cents | null } {
  const amortisingMonths = terms.termMonths - terms.graceMonths;
  const amortises = terms.repayment !== 'aflossingsvrij' && amortisingMonths > 0;
  const annuity =
    amortises && terms.repayment === 'annuitair'
      ? annuityPayment(terms.principalCents, terms.annualRateBp, amortisingMonths)
      : null;
  const linear =
    amortises && terms.repayment === 'lineair' ? roundCents(terms.principalCents / amortisingMonths) : null;

  let balance = terms.isNew ? 0 : terms.principalCents;
  const rows = Array.from({ length }, (_, month): ScheduleRow => {
    const openingBalance = balance;
    const elapsed = month - terms.startMonth;
    let drawdown = 0;
    let interest = 0;
    let principal = 0;

    if (elapsed === 0 && terms.isNew) {
      drawdown = terms.principalCents;
      balance += drawdown;
    }
    if (elapsed >= 1 && elapsed <= terms.termMonths) {
      interest = monthlyInterest(balance, terms.annualRateBp);
      if (elapsed === terms.termMonths) principal = balance;
      else if (elapsed > terms.graceMonths)
        principal = Math.min(balance, annuity === null ? (linear ?? 0) : annuity - interest);
      balance -= principal;
    }
    return { month, openingBalance, drawdown, interest, principal, closingBalance: balance };
  });

  return { rows, annuityPayment: annuity, linearPrincipal: linear };
}

export function periodDebtSummaries(
  interest: readonly Cents[],
  principal: readonly Cents[],
  closingBalance: readonly Cents[],
  timeline: Timeline,
): PeriodDebtSummary[] {
  return timeline.periods.map((period, index) => {
    const { first, last } = periodRange(period, index === 0);
    return {
      period: period.key,
      interest: sumRange(interest, first, last),
      principal: sumRange(principal, first, last),
      closingBalance: at(closingBalance, last),
    };
  });
}

function toLoanSchedule(
  base: Pick<LoanSchedule, 'lineId' | 'origin' | 'kind' | 'subordinated' | 'principal'>,
  schedule: ReturnType<typeof buildSchedule>,
  timeline: Timeline,
): LoanSchedule {
  const { rows } = schedule;
  return {
    ...base,
    annuityPayment: schedule.annuityPayment,
    linearPrincipal: schedule.linearPrincipal,
    rows,
    periods: periodDebtSummaries(
      rows.map((row) => row.interest),
      rows.map((row) => row.principal),
      rows.map((row) => row.closingBalance),
      timeline,
    ),
  };
}

/** Nieuwe leningen, lease en achtergestelde leningen, plus de bestaande schulden. Kredieten niet. */
export function buildLoanSchedules(financing: FinancingInput, timeline: Timeline): LoanSchedule[] {
  const length = timeline.months.length;
  const newLoans = financing.lines.filter(isLoanLine).map((line) =>
    toLoanSchedule(
      {
        lineId: line.id,
        origin: 'nieuw',
        kind: line.kind,
        subordinated: line.kind === 'achtergestelde_lening',
        principal: line.principalCents,
      },
      buildSchedule(
        {
          principalCents: line.principalCents,
          annualRateBp: line.annualRateBp,
          termMonths: line.termMonths,
          graceMonths: line.graceMonths,
          repayment: line.repayment,
          startMonth: line.startMonth,
          isNew: true,
        },
        length,
      ),
      timeline,
    ),
  );
  const existing = financing.existingDebts.map((debt) =>
    toLoanSchedule(
      {
        lineId: debt.id,
        origin: 'bestaand',
        kind: 'bestaande_schuld',
        subordinated: false,
        principal: debt.outstandingCents,
      },
      buildSchedule(
        {
          principalCents: debt.outstandingCents,
          annualRateBp: debt.annualRateBp,
          termMonths: debt.remainingMonths,
          graceMonths: 0,
          repayment: debt.repayment,
          startMonth: 0,
          isNew: false,
        },
        length,
      ),
      timeline,
    ),
  );
  return [...newLoans, ...existing];
}
