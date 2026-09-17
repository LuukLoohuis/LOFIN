import { periodRange } from '../core/calendar';
import { sum } from '../core/money';
import { at, cumulative } from '../core/series';
import type { Cents, MonthIndex, OpeningBalanceInput, PlanInput } from '../types/input';
import type { BalanceSheet, PeriodKey } from '../types/result';
import type { Ledger } from './ledger';

const EMPTY_OPENING: OpeningBalanceInput = {
  fixedAssetsCents: 0,
  annualDepreciationCents: 0,
  stockCents: 0,
  receivablesCents: 0,
  cashCents: 0,
  equityCents: 0,
  payablesCents: 0,
  otherLiabilitiesCents: 0,
};

export interface OpeningPosition {
  sheet: BalanceSheet;
  /** Activa min passiva zoals ingevoerd; het verschil staat bij overige schulden. */
  difference: Cents;
  annualDepreciationCents: Cents;
}

/** Starters beginnen leeg. Bestaande schulden komen uit stap 5, niet uit de balansinvoer. */
export function buildOpeningBalance(input: PlanInput): OpeningPosition {
  const opening = input.history.openingBalance ?? EMPTY_OPENING;
  const loans = sum(input.financing.existingDebts.map((debt) => debt.outstandingCents));
  const totalAssets = opening.fixedAssetsCents + opening.stockCents + opening.receivablesCents + opening.cashCents;
  const difference =
    totalAssets - (opening.equityCents + loans + opening.payablesCents + opening.otherLiabilitiesCents);

  return {
    sheet: {
      fixedAssets: opening.fixedAssetsCents,
      stock: opening.stockCents,
      receivables: opening.receivablesCents,
      vatReceivable: 0,
      cash: opening.cashCents,
      totalAssets,
      equity: opening.equityCents,
      subordinatedLoans: 0,
      loans,
      creditDrawn: 0,
      payables: opening.payablesCents,
      vatPayable: 0,
      corporateTaxPayable: 0,
      otherLiabilities: opening.otherLiabilitiesCents + difference,
      totalLiabilities: totalAssets,
    },
    difference,
    annualDepreciationCents: opening.annualDepreciationCents,
  };
}

/**
 * Vereenvoudigde balans aan het eind van elke maand, opgebouwd uit dezelfde reeksen als de
 * resultatenrekening en de kasstroom. Sluit hij niet, dan zit er een fout in de rekenkern.
 */
export function buildBalanceSheets(ledger: Ledger): {
  opening: BalanceSheet;
  monthly: BalanceSheet[];
  periodEnds: (BalanceSheet & { period: PeriodKey })[];
} {
  const opening = ledger.opening.sheet;
  const salesInclVat = cumulative(ledger.salesInclVat);
  const receipts = cumulative(ledger.customerReceipts);
  const purchasesInclVat = cumulative(ledger.purchasesInclVat);
  const purchasesPaid = cumulative(ledger.costOfSalesPaid);
  const equityMovements = cumulative(
    ledger.netResult.map(
      (result, month) =>
        result +
        at(ledger.ownContribution, month) +
        at(ledger.grants, month) -
        at(ledger.privateWithdrawals, month) -
        at(ledger.dividends, month),
    ),
  );
  const taxOwed = cumulative(ledger.taxAccrual.map((accrued, month) => accrued - at(ledger.taxPaid, month)));
  const assetBookValues = [ledger.existingAssets, ...ledger.investments.schedules].map((s) => s.bookValue);
  const loanBalances = ledger.loans.map((loan) => ({
    subordinated: loan.subordinated,
    closing: loan.rows.map((row) => row.closingBalance),
  }));
  const loansAt = (month: MonthIndex, subordinated: boolean) =>
    sum(loanBalances.filter((loan) => loan.subordinated === subordinated).map((loan) => at(loan.closing, month)));

  const sheetAt = (month: MonthIndex): BalanceSheet => {
    const closingCash = at(ledger.closingCash, month);
    const vatPosition = at(ledger.vat.position, month);
    const assets = {
      fixedAssets: sum(assetBookValues.map((bookValue) => at(bookValue, month))),
      stock: opening.stock + at(ledger.investments.stock, month),
      receivables: opening.receivables + at(salesInclVat, month) - at(receipts, month),
      vatReceivable: Math.max(0, -vatPosition),
      cash: Math.max(0, closingCash),
    };
    const liabilities = {
      equity: opening.equity + at(equityMovements, month),
      subordinatedLoans: loansAt(month, true),
      loans: loansAt(month, false),
      creditDrawn: Math.max(0, -closingCash),
      payables: opening.payables + at(purchasesInclVat, month) - at(purchasesPaid, month),
      vatPayable: Math.max(0, vatPosition),
      corporateTaxPayable: at(taxOwed, month),
      otherLiabilities: opening.otherLiabilities,
    };
    return {
      ...assets,
      totalAssets: sum(Object.values(assets)),
      ...liabilities,
      totalLiabilities: sum(Object.values(liabilities)),
    };
  };

  return {
    opening,
    monthly: ledger.timeline.months.map((meta) => sheetAt(meta.index)),
    periodEnds: ledger.timeline.periods.map((period, index) => ({
      period: period.key,
      ...sheetAt(periodRange(period, index === 0).last),
    })),
  };
}
