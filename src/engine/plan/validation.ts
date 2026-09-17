import { BP_PER_UNIT, sum } from '../core/money';
import { at } from '../core/series';
import type { MonthIndex, PlanInput } from '../types/input';
import type { FinancingNeedResult, Issue } from '../types/result';
import type { Ledger } from './ledger';
import { lowestCash } from './ratios';
import { validateSeasonality } from './revenue';

function outsideHorizon(path: string, month: MonthIndex): Issue {
  return { code: 'MONTH_OUTSIDE_HORIZON', severity: 'warning', path, params: { month } };
}

/**
 * Inhoudelijke signalen over een doorgerekend plan. Fouten blokkeren het indienen,
 * waarschuwingen en meldingen niet. De Nederlandse teksten staan in de config.
 */
export function collectIssues(input: PlanInput, ledger: Ledger, need: FinancingNeedResult): Issue[] {
  const issues: Issue[] = [];
  const length = ledger.timeline.months.length;
  const { assumptions, financing } = input;

  const seasonality = validateSeasonality(assumptions.seasonality);
  if (seasonality !== null) issues.push(seasonality);

  const vatShares = sum(assumptions.vat.revenueRates.map((rate) => rate.shareBp));
  if (vatShares !== BP_PER_UNIT) {
    issues.push({
      code: 'VAT_MIX_INVALID',
      severity: 'error',
      path: 'assumptions.vat.revenueRates',
      params: { sum: vatShares },
    });
  }

  if (need.difference !== 0) {
    issues.push({
      code: 'FUNDING_IMBALANCE',
      severity: 'error',
      path: 'financing.lines',
      params: { difference: need.difference, uses: need.uses.total, sources: need.sources.total },
    });
  }

  financing.lines.forEach((line, index) => {
    const path = `financing.lines.${index}`;
    if (line.startMonth >= length) issues.push(outsideHorizon(`${path}.startMonth`, line.startMonth));
    if (line.kind === 'krediet') return;
    if (line.repayment !== 'aflossingsvrij' && line.graceMonths >= line.termMonths) {
      issues.push({
        code: 'GRACE_TOO_LONG',
        severity: 'error',
        path: `${path}.graceMonths`,
        params: { graceMonths: line.graceMonths, termMonths: line.termMonths },
      });
    }
    const finalMonth = line.startMonth + line.termMonths;
    const interestOnly = line.repayment === 'aflossingsvrij' || line.graceMonths >= line.termMonths;
    if (interestOnly && finalMonth < length) {
      issues.push({
        code: 'BALLOON_IN_HORIZON',
        severity: 'info',
        path,
        params: { month: finalMonth, amount: line.principalCents },
      });
    }
  });

  input.need.investments.forEach((item, index) => {
    if (item.purchaseMonth >= length) issues.push(outsideHorizon(`need.investments.${index}.purchaseMonth`, item.purchaseMonth));
  });
  input.need.oneOffCosts.forEach((cost, index) => {
    if (cost.month >= length) issues.push(outsideHorizon(`need.oneOffCosts.${index}.month`, cost.month));
  });
  input.need.grants.forEach((grant, index) => {
    if (grant.month >= length) issues.push(outsideHorizon(`need.grants.${index}.month`, grant.month));
  });

  const firstNegative = ledger.closingCash.findIndex((cash) => cash < 0);
  if (firstNegative !== -1) {
    const lowest = lowestCash(ledger.closingCash);
    issues.push({
      code: 'NEGATIVE_CASH',
      severity: 'warning',
      path: 'cashflow',
      params: { month: firstNegative, lowestAmount: lowest.amount, lowestMonth: lowest.month },
    });
  }

  const firstShortfall = ledger.shortfall.findIndex((gap) => gap > 0);
  if (ledger.creditLines.length > 0 && firstShortfall !== -1) {
    issues.push({
      code: 'CREDIT_LIMIT_EXCEEDED',
      severity: 'warning',
      path: 'financing.lines',
      params: { month: firstShortfall, shortfall: at(ledger.shortfall, firstShortfall) },
    });
  }

  if (ledger.opening.difference !== 0) {
    issues.push({
      code: 'OPENING_BALANCE_MISMATCH',
      severity: 'warning',
      path: 'history.openingBalance',
      params: { difference: ledger.opening.difference },
    });
  }

  if (ledger.isBv && assumptions.privateWithdrawalsMonthlyCents > 0) {
    issues.push({
      code: 'WITHDRAWALS_IGNORED_FOR_BV',
      severity: 'warning',
      path: 'assumptions.privateWithdrawalsMonthlyCents',
      params: { amount: assumptions.privateWithdrawalsMonthlyCents },
    });
  }

  return issues;
}
