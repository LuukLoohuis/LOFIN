import { periodRange } from '../core/calendar';
import { at, sumRange } from '../core/series';
import type { Cents, MonthIndex } from '../types/input';
import type { CashRow, MonthMeta, PeriodKey } from '../types/result';
import type { Ledger } from './ledger';

export function cashForRange(ledger: Ledger, first: MonthIndex, last: MonthIndex): CashRow {
  const total = (values: readonly Cents[]) => sumRange(values, first, last);

  const receipts = {
    customers: total(ledger.customerReceipts),
    financing: total(ledger.drawdowns),
    ownContribution: total(ledger.ownContribution),
    grants: total(ledger.grants),
    vatRefund: total(ledger.vat.refunds),
  };
  const operations = {
    costOfSales: total(ledger.costOfSalesPaid),
    fixedCosts: total(ledger.fixedCostsPaid),
    staff: total(ledger.staff),
    oneOffCosts: total(ledger.oneOffCostsPaid),
  };
  const operationsTotal = operations.costOfSales + operations.fixedCosts + operations.staff + operations.oneOffCosts;
  const payments = {
    vat: total(ledger.vat.payments),
    investments: total(ledger.investmentsPaid),
    interest: total(ledger.interest),
    repayments: total(ledger.repayments),
    privateWithdrawals: total(ledger.privateWithdrawals),
    corporateTax: total(ledger.taxPaid),
    dividend: total(ledger.dividends),
  };
  const receiptsTotal =
    receipts.customers + receipts.financing + receipts.ownContribution + receipts.grants + receipts.vatRefund;
  const paymentsTotal =
    operationsTotal +
    payments.vat +
    payments.investments +
    payments.interest +
    payments.repayments +
    payments.privateWithdrawals +
    payments.corporateTax +
    payments.dividend;

  return {
    openingCash: at(ledger.openingCash, first),
    receipts: { ...receipts, total: receiptsTotal },
    payments: { operations: { ...operations, total: operationsTotal }, ...payments, total: paymentsTotal },
    netCashflow: receiptsTotal - paymentsTotal,
    closingCash: at(ledger.closingCash, last),
    creditLimit: at(ledger.creditLimit, last),
    creditDrawn: at(ledger.creditDrawn, last),
    shortfall: at(ledger.shortfall, last),
  };
}

/** Kalenderkwartalen; het startmoment hoort bij het kwartaal van de eerste prognosemaand. */
export function quarterRanges(
  months: readonly MonthMeta[],
): { year: number; quarter: 1 | 2 | 3 | 4; first: MonthIndex; last: MonthIndex }[] {
  const ranges: { year: number; quarter: 1 | 2 | 3 | 4; first: MonthIndex; last: MonthIndex }[] = [];
  for (const meta of months) {
    const current = ranges.at(-1);
    if (current !== undefined && current.year === meta.year && current.quarter === meta.quarter) {
      current.last = meta.index;
    } else {
      ranges.push({ year: meta.year, quarter: meta.quarter, first: meta.index, last: meta.index });
    }
  }
  return ranges;
}

export function buildCashflow(ledger: Ledger): {
  monthly: CashRow[];
  quarterly: (CashRow & { year: number; quarter: 1 | 2 | 3 | 4 })[];
  periods: (CashRow & { period: PeriodKey })[];
} {
  const { months, periods } = ledger.timeline;
  return {
    monthly: months.map((meta) => cashForRange(ledger, meta.index, meta.index)),
    quarterly: quarterRanges(months).map(({ year, quarter, first, last }) => ({
      year,
      quarter,
      ...cashForRange(ledger, first, last),
    })),
    periods: periods.map((period, index) => {
      const { first, last } = periodRange(period, index === 0);
      return { period: period.key, ...cashForRange(ledger, first, last) };
    }),
  };
}
