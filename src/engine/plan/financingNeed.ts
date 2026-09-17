import { applyBp, MONTHS_PER_YEAR, roundCents, sum } from '../core/money';
import type { Cents, FinancingLine, InvestmentCategory, MonthIndex, PlanInput } from '../types/input';
import type { FinancingNeedResult, VatResult } from '../types/result';

function lineAmount(line: FinancingLine): Cents {
  return line.kind === 'krediet' ? line.limitCents : line.principalCents;
}

/**
 * Financieringsbehoefte = investeringen + werkkapitaal + eenmalige kosten − eigen inbreng
 * − subsidies − overige financiering. De aangevraagde financiering moet dat gat precies dekken.
 */
export function buildFinancingNeed(input: PlanInput, vat: VatResult): FinancingNeedResult {
  const { need, financing } = input;

  const investmentsByCategory: Record<InvestmentCategory, Cents> = {
    bedrijfsmiddel: 0,
    verbouwing: 0,
    voorraad: 0,
    immaterieel: 0,
    overig: 0,
  };
  const vatByPurchaseMonth = new Map<MonthIndex, Cents>();
  for (const item of need.investments) {
    investmentsByCategory[item.category] += item.amountCents;
    const itemVat = applyBp(item.amountCents, item.vatRateBp);
    vatByPurchaseMonth.set(item.purchaseMonth, (vatByPurchaseMonth.get(item.purchaseMonth) ?? 0) + itemVat);
  }

  const investments = sum(Object.values(investmentsByCategory));
  const oneOffCosts = sum(need.oneOffCosts.map((cost) => cost.amountCents));
  const usesTotal = investments + need.workingCapitalCents + oneOffCosts;

  const grants = sum(need.grants.map((grant) => grant.amountCents));
  const otherFinancing = sum(financing.lines.filter((line) => !line.isRequested).map(lineAmount));
  const requestedFinancing = sum(financing.lines.filter((line) => line.isRequested).map(lineAmount));
  const sourcesTotal = need.ownContributionCents + grants + otherFinancing + requestedFinancing;

  const settlements = [...vatByPurchaseMonth]
    .sort(([monthA], [monthB]) => monthA - monthB)
    .map(([purchaseMonth, monthVat]) => ({
      purchaseMonth,
      vat: monthVat,
      settledInMonth: vat.settlementMonth[purchaseMonth] ?? null,
    }));

  return {
    uses: {
      investmentsByCategory,
      investments,
      workingCapital: need.workingCapitalCents,
      oneOffCosts,
      total: usesTotal,
    },
    sources: {
      ownContribution: need.ownContributionCents,
      grants,
      otherFinancing,
      requestedFinancing,
      total: sourcesTotal,
    },
    financingNeed: usesTotal - need.ownContributionCents - grants - otherFinancing,
    difference: sourcesTotal - usesTotal,
    vatOnInvestments: { total: sum(settlements.map((settlement) => settlement.vat)), settlements },
  };
}

/**
 * Hulpmiddel voor stap 2: debiteuren + voorraad − crediteuren, op basis van dagen.
 * Een schatting exclusief btw; de ondernemer kiest zelf het bedrag.
 */
export function estimateWorkingCapital(
  params: {
    annualRevenueCents: Cents;
    annualCostOfSalesCents: Cents;
    debtorDays: number;
    creditorDays: number;
    stockDays: number;
  },
  daysPerMonth: number,
): Cents {
  const daysPerYear = daysPerMonth * MONTHS_PER_YEAR;
  const receivables = (params.annualRevenueCents * params.debtorDays) / daysPerYear;
  const stock = (params.annualCostOfSalesCents * params.stockDays) / daysPerYear;
  const payables = (params.annualCostOfSalesCents * params.creditorDays) / daysPerYear;
  return Math.max(0, roundCents(receivables + stock - payables));
}
