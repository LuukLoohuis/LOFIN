import { periodRange } from '../core/calendar';
import { sumRange } from '../core/series';
import type { Cents, MonthIndex } from '../types/input';
import type { PeriodKey, PnlRow } from '../types/result';
import type { Ledger } from './ledger';

/**
 * EBIT = omzet − inkoopwaarde − vaste kosten − personeel − eenmalige kosten − afschrijving.
 * CFADS: eenmanszaak/vof EBIT + afschrijving − privé-opnamen; bv EBIT + afschrijving − vpb − dividend.
 */
export function pnlForRange(ledger: Ledger, first: MonthIndex, last: MonthIndex): PnlRow {
  const total = (values: readonly Cents[]) => sumRange(values, first, last);
  const { byCategory } = ledger.fixedCosts;

  const revenue = total(ledger.revenue);
  const costOfSales = total(ledger.costOfSales);
  const depreciation = total(ledger.depreciation);
  const ebit = total(ledger.ebit);
  const interest = total(ledger.interest);
  const corporateTax = total(ledger.taxAccrual);
  const privateWithdrawals = total(ledger.privateWithdrawals);
  const dividend = total(ledger.dividends);
  const repayments = total(ledger.repayments);

  return {
    revenue,
    costOfSales,
    grossMargin: revenue - costOfSales,
    fixedCosts: {
      huur: total(byCategory.huur),
      vervoer: total(byCategory.vervoer),
      verzekeringen: total(byCategory.verzekeringen),
      telefoon_software: total(byCategory.telefoon_software),
      accountant: total(byCategory.accountant),
      marketing: total(byCategory.marketing),
      overig: total(byCategory.overig),
    },
    fixedCostsTotal: total(ledger.fixedCosts.total),
    staff: total(ledger.staff),
    oneOffCosts: total(ledger.oneOffCosts.amount),
    depreciation,
    ebit,
    interest,
    resultBeforeTax: ebit - interest,
    corporateTax,
    netResult: ebit - interest - corporateTax,
    privateWithdrawals,
    dividend,
    cfads: ledger.isBv
      ? ebit + depreciation - corporateTax - dividend
      : ebit + depreciation - privateWithdrawals,
    repayments,
    debtService: interest + repayments,
  };
}

export function buildPnl(ledger: Ledger): { monthly: PnlRow[]; periods: (PnlRow & { period: PeriodKey })[] } {
  return {
    monthly: ledger.timeline.months.map((meta) => pnlForRange(ledger, meta.index, meta.index)),
    periods: ledger.timeline.periods.map((period, index) => {
      const { first, last } = periodRange(period, index === 0);
      return { period: period.key, ...pnlForRange(ledger, first, last) };
    }),
  };
}
