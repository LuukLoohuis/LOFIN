import { buildTimeline, parseYearMonth, periodRange, type Timeline } from '../core/calendar';
import { EngineInputError } from '../core/errors';
import { applyBp, BP_PER_UNIT, cumulativeShare, monthlyInterest, sum } from '../core/money';
import { addSeries, at, subtractSeries, zeros } from '../core/series';
import { shiftByDays } from '../core/timing';
import type { EngineConfig } from '../types/config';
import type { Bp, Cents, CreditLine, PlanInput } from '../types/input';
import type { AssetSchedule, CreditLineUsage, LoanSchedule, VatResult } from '../types/result';
import { buildOpeningBalance, type OpeningPosition } from './balanceSheet';
import {
  buildDividends,
  buildFixedCosts,
  buildOneOffCosts,
  buildPrivateWithdrawals,
  buildStaffCosts,
  type FixedCostsResult,
} from './costs';
import { buildInvestments, existingAssetsSchedule, type InvestmentsResult } from './depreciation';
import { buildLoanSchedules, isCreditLine, periodDebtSummaries } from './loans';
import { buildRevenue } from './revenue';
import { corporateTax } from './tax';
import { buildVat } from './vat';

/**
 * Alle maandreeksen van één doorrekening (index 0 = startmoment). Resultatenrekening,
 * kasstroom, balans en ratio's zijn hier sommen en selecties van; ze rekenen zelf niets.
 */
export interface Ledger {
  input: PlanInput;
  timeline: Timeline;
  isBv: boolean;
  opening: OpeningPosition;

  revenue: Cents[];
  costOfSales: Cents[];
  fixedCosts: FixedCostsResult;
  staff: Cents[];
  oneOffCosts: { amount: Cents[]; vat: Cents[] };
  investments: InvestmentsResult;
  existingAssets: AssetSchedule;
  depreciation: Cents[];
  ebit: Cents[];
  interest: Cents[];
  taxAccrual: Cents[];
  netResult: Cents[];

  loans: LoanSchedule[];
  creditLines: CreditLineUsage[];
  drawdowns: Cents[];
  repayments: Cents[];

  vat: VatResult;
  salesInclVat: Cents[];
  purchasesInclVat: Cents[];

  customerReceipts: Cents[];
  ownContribution: Cents[];
  grants: Cents[];
  costOfSalesPaid: Cents[];
  fixedCostsPaid: Cents[];
  oneOffCostsPaid: Cents[];
  investmentsPaid: Cents[];
  privateWithdrawals: Cents[];
  dividends: Cents[];
  taxPaid: Cents[];

  openingCash: Cents[];
  closingCash: Cents[];
  creditLimit: Cents[];
  creditDrawn: Cents[];
  shortfall: Cents[];
}

export function buildLedger(input: PlanInput, config: EngineConfig, scenarioDeltaBp: Bp): Ledger {
  const start = parseYearMonth(input.assumptions.startMonth);
  if (start === null) throw new EngineInputError(`Ongeldige startmaand: '${input.assumptions.startMonth}'`);

  const timeline = buildTimeline(start);
  const length = timeline.months.length;
  const { assumptions, need, financing, company } = input;
  const isBv = company.legalForm === 'bv';
  const opening = buildOpeningBalance(input);

  // Resultaat
  const revenue = buildRevenue(assumptions, timeline, config.revenueRampUpMonths, scenarioDeltaBp);
  const costOfSales = revenue.map((amount) => applyBp(amount, assumptions.costOfSalesBp));
  const fixedCosts = buildFixedCosts(assumptions.fixedCosts, timeline, assumptions.costGrowthBp);
  const staff = buildStaffCosts(assumptions.staff, timeline, assumptions.costGrowthBp);
  const oneOffCosts = buildOneOffCosts(need.oneOffCosts, length);
  const investments = buildInvestments(need.investments, length);
  const existingAssets = existingAssetsSchedule(opening.sheet.fixedAssets, opening.annualDepreciationCents, length);
  const depreciation = addSeries(existingAssets.depreciation, ...investments.schedules.map((s) => s.depreciation));
  const ebit = revenue.map(
    (amount, m) =>
      amount -
      at(costOfSales, m) -
      at(fixedCosts.total, m) -
      at(staff, m) -
      at(oneOffCosts.amount, m) -
      at(depreciation, m),
  );

  // Financiering (kredieten volgen in de maandloop)
  const loans = buildLoanSchedules(financing, timeline);
  const loanSeries = (pick: (row: LoanSchedule['rows'][number]) => Cents) =>
    addSeries(zeros(length), ...loans.map((loan) => loan.rows.map(pick)));
  const loanInterest = loanSeries((row) => row.interest);
  const repayments = loanSeries((row) => row.principal);
  const drawdowns = loanSeries((row) => row.drawdown);

  // Btw
  const outputVatRateBp = sum(assumptions.vat.revenueRates.map((r) => r.rateBp * r.shareBp)) / BP_PER_UNIT;
  const outputVat = revenue.map((amount) => applyBp(amount, outputVatRateBp));
  const costOfSalesVat = costOfSales.map((amount) => applyBp(amount, assumptions.costOfSalesVatRateBp));
  const vat = buildVat(
    outputVat,
    addSeries(costOfSalesVat, fixedCosts.vat, oneOffCosts.vat, investments.vat),
    timeline,
    assumptions.vat.filing,
  );

  // Kasstromen buiten de maandloop
  const salesInclVat = addSeries(revenue, outputVat);
  const purchasesInclVat = addSeries(costOfSales, costOfSalesVat);
  const customerReceipts = shiftByDays(salesInclVat, assumptions.debtorDays, config.daysPerMonth).shifted;
  const costOfSalesPaid = shiftByDays(purchasesInclVat, assumptions.creditorDays, config.daysPerMonth).shifted;
  // Openstaande posten van de openingsbalans worden in de eerste prognosemaand afgewikkeld.
  customerReceipts[1] = at(customerReceipts, 1) + opening.sheet.receivables;
  costOfSalesPaid[1] = at(costOfSalesPaid, 1) + opening.sheet.payables;

  const ownContribution = zeros(length);
  ownContribution[0] = need.ownContributionCents;
  const grants = zeros(length);
  for (const grant of need.grants.filter((g) => g.month < length)) {
    grants[grant.month] = at(grants, grant.month) + grant.amountCents;
  }
  const fixedCostsPaid = addSeries(fixedCosts.total, fixedCosts.vat);
  const oneOffCostsPaid = addSeries(oneOffCosts.amount, oneOffCosts.vat);
  const investmentsPaid = addSeries(investments.exVat, investments.vat);
  const privateWithdrawals = buildPrivateWithdrawals(assumptions.privateWithdrawalsMonthlyCents, company.legalForm, length);
  const dividends = buildDividends(assumptions.dividendCents, company.legalForm, timeline);

  // Maandloop: kredietrente hangt af van het saldo, de vpb van het resultaat inclusief die rente.
  const credits = financing.lines.filter(isCreditLine).map((line: CreditLine) => ({
    line,
    usage: { lineId: line.id, limit: line.limitCents, drawn: zeros(length), interest: zeros(length), periods: [] },
  }));
  const interest = zeros(length);
  const taxAccrual = zeros(length);
  const taxPaid = zeros(length);
  const openingCash = zeros(length);
  const closingCash = zeros(length);
  const creditLimit = zeros(length);
  const creditDrawn = zeros(length);
  const shortfall = zeros(length);

  let cash = opening.sheet.cash;
  let lossCarryForward = 0;

  timeline.periods.forEach((period, periodIndex) => {
    const { first, last } = periodRange(period, periodIndex === 0);
    let resultBeforeTax = 0;

    for (let m = first; m <= last; m++) {
      openingCash[m] = cash;
      // Rente over de roodstand van de vorige maand; zo ontstaat ook in Excel geen kringverwijzing.
      for (const { line, usage } of credits) {
        usage.interest[m] = monthlyInterest(at(usage.drawn, m - 1), line.annualRateBp);
      }
      interest[m] = at(loanInterest, m) + sum(credits.map(({ usage }) => at(usage.interest, m)));

      const receipts =
        at(customerReceipts, m) + at(drawdowns, m) + at(ownContribution, m) + at(grants, m) + at(vat.refunds, m);
      const payments =
        at(costOfSalesPaid, m) +
        at(fixedCostsPaid, m) +
        at(staff, m) +
        at(oneOffCostsPaid, m) +
        at(vat.payments, m) +
        at(investmentsPaid, m) +
        at(interest, m) +
        at(repayments, m) +
        at(privateWithdrawals, m) +
        at(taxPaid, m) +
        at(dividends, m);
      cash += receipts - payments;
      closingCash[m] = cash;

      let uncovered = Math.max(0, -cash);
      for (const { line, usage } of credits) {
        const available = line.startMonth <= m ? line.limitCents : 0;
        const drawn = Math.min(uncovered, available);
        usage.drawn[m] = drawn;
        uncovered -= drawn;
        creditLimit[m] = at(creditLimit, m) + available;
        creditDrawn[m] = at(creditDrawn, m) + drawn;
      }
      shortfall[m] = uncovered;
      resultBeforeTax += at(ebit, m) - at(interest, m);
    }

    if (!isBv) return;
    const taxable = Math.max(0, resultBeforeTax - lossCarryForward);
    lossCarryForward = Math.max(0, lossCarryForward - resultBeforeTax);
    const tax = corporateTax(taxable, config.corporateTaxBrackets);
    for (let position = 1; position <= period.months; position++) {
      taxAccrual[period.firstMonth + position - 1] = cumulativeShare(tax, position, period.months);
    }
    // De aanslag over een periode wordt in termijnen in het volgende boekjaar betaald.
    const next = timeline.periods[periodIndex + 1];
    if (next === undefined) return;
    for (let position = 1; position <= next.months; position++) {
      taxPaid[next.firstMonth + position - 1] = cumulativeShare(tax, position, next.months);
    }
  });

  const creditLines = credits.map(
    ({ usage }): CreditLineUsage => ({
      ...usage,
      periods: periodDebtSummaries(usage.interest, zeros(length), usage.drawn, timeline),
    }),
  );

  return {
    input,
    timeline,
    isBv,
    opening,
    revenue,
    costOfSales,
    fixedCosts,
    staff,
    oneOffCosts,
    investments,
    existingAssets,
    depreciation,
    ebit,
    interest,
    taxAccrual,
    netResult: subtractSeries(subtractSeries(ebit, interest), taxAccrual),
    loans,
    creditLines,
    drawdowns,
    repayments,
    vat,
    salesInclVat,
    purchasesInclVat,
    customerReceipts,
    ownContribution,
    grants,
    costOfSalesPaid,
    fixedCostsPaid,
    oneOffCostsPaid,
    investmentsPaid,
    privateWithdrawals,
    dividends,
    taxPaid,
    openingCash,
    closingCash,
    creditLimit,
    creditDrawn,
    shortfall,
  };
}
