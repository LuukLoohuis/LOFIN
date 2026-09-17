import type { Timeline } from '../core/calendar';
import { applyBp, cumulativeShare, growthMultiplier, MONTHS_PER_YEAR, roundCents } from '../core/money';
import { at, zeros } from '../core/series';
import type {
  AssumptionsInput,
  Cents,
  FixedCostCategory,
  FixedCostLine,
  LegalForm,
  OneOffCost,
  StaffLine,
  YearGrowth,
} from '../types/input';
import { periodGrowthFactor } from './growth';

export interface FixedCostsResult {
  byCategory: Record<FixedCostCategory, Cents[]>;
  total: Cents[];
  vat: Cents[];
}

export function emptyByCategory(length: number): Record<FixedCostCategory, Cents[]> {
  return {
    huur: zeros(length),
    vervoer: zeros(length),
    verzekeringen: zeros(length),
    telefoon_software: zeros(length),
    accountant: zeros(length),
    marketing: zeros(length),
    overig: zeros(length),
  };
}

/**
 * Vaste kosten per maand. Een jaarbedrag wordt cumulatief over twaalf maanden verdeeld,
 * zodat een vol boekjaar exact het jaarbedrag optelt; een startperiode krijgt het deel
 * dat bij haar maanden hoort. Btw wordt per regel per maand berekend.
 */
export function buildFixedCosts(
  lines: readonly FixedCostLine[],
  timeline: Timeline,
  costGrowth: YearGrowth,
): FixedCostsResult {
  const length = timeline.months.length;
  const result: FixedCostsResult = { byCategory: emptyByCategory(length), total: zeros(length), vat: zeros(length) };

  for (const line of lines) {
    const category = result.byCategory[line.category];
    for (const period of timeline.periods) {
      const factor = periodGrowthFactor(period.key, costGrowth);
      for (let position = 1; position <= period.months; position++) {
        const index = period.firstMonth + position - 1;
        const amount =
          line.per === 'maand'
            ? roundCents(line.amountCents * factor)
            : cumulativeShare(line.amountCents * factor, position, MONTHS_PER_YEAR);
        category[index] = at(category, index) + amount;
        result.total[index] = at(result.total, index) + amount;
        result.vat[index] = at(result.vat, index) + applyBp(amount, line.vatRateBp);
      }
    }
  }
  return result;
}

/** Brutoloon plus werkgeverslasten, vanaf de startmaand (op zijn vroegst maand 1). */
export function buildStaffCosts(lines: readonly StaffLine[], timeline: Timeline, costGrowth: YearGrowth): Cents[] {
  return timeline.months.map((meta) => {
    let total = 0;
    for (const line of lines) {
      const started = meta.index >= Math.max(1, line.startMonth);
      const ended = line.endMonth !== null && meta.index > line.endMonth;
      if (started && !ended) {
        total += roundCents(
          line.grossMonthlyCents * growthMultiplier(line.employerCostBp) * periodGrowthFactor(meta.period, costGrowth),
        );
      }
    }
    return total;
  });
}

export function buildOneOffCosts(items: readonly OneOffCost[], length: number): { amount: Cents[]; vat: Cents[] } {
  const amount = zeros(length);
  const vat = zeros(length);
  for (const item of items.filter((cost) => cost.month < length)) {
    amount[item.month] = at(amount, item.month) + item.amountCents;
    vat[item.month] = at(vat, item.month) + applyBp(item.amountCents, item.vatRateBp);
  }
  return { amount, vat };
}

/** Alleen eenmanszaak en vof; een bv keert dividend uit. */
export function buildPrivateWithdrawals(monthlyCents: Cents, legalForm: LegalForm, length: number): Cents[] {
  return Array.from({ length }, (_, index) => (legalForm !== 'bv' && index > 0 ? monthlyCents : 0));
}

/** Bv: dividend in de laatste maand van elk boekjaar. */
export function buildDividends(
  dividendCents: AssumptionsInput['dividendCents'],
  legalForm: LegalForm,
  timeline: Timeline,
): Cents[] {
  const result = zeros(timeline.months.length);
  if (legalForm !== 'bv') return result;
  for (const period of timeline.periods) {
    if (period.key !== 'start') result[period.lastMonth] = dividendCents[period.key];
  }
  return result;
}
