import { roundCents, sum } from '../core/money';
import { at } from '../core/series';
import type { EngineConfig, HigherIsBetterBands, LowerIsBetterBands } from '../types/config';
import type { Cents, MonthIndex } from '../types/input';
import type { BalanceSheet, Light, PeriodKey, PeriodRatio, PnlRow, Ratios } from '../types/result';
import type { Ledger } from './ledger';
import { isLoanLine } from './loans';

export function classifyHigherIsBetter(value: number | null, bands: HigherIsBetterBands): Light {
  if (value === null) return 'geen';
  if (value < bands.orangeFrom) return 'rood';
  return value < bands.greenFrom ? 'oranje' : 'groen';
}

export function classifyLowerIsBetter(value: number, bands: LowerIsBetterBands): Light {
  if (value <= bands.greenMax) return 'groen';
  return value <= bands.orangeMax ? 'oranje' : 'rood';
}

/** DSCR = CFADS / (rente + aflossing). Zonder schuldendienst is er geen ratio. */
export function dscrByPeriod(periods: readonly (PnlRow & { period: PeriodKey })[], config: EngineConfig): PeriodRatio[] {
  return periods.map((row) => {
    const value = row.debtService > 0 ? row.cfads / row.debtService : null;
    return { period: row.period, value, light: classifyHigherIsBetter(value, config.ratios.dscr) };
  });
}

/** Laagste eindsaldo over de hele horizon; bij gelijke standen telt de eerste maand. */
export function lowestCash(closingCash: readonly Cents[]): { amount: Cents; month: MonthIndex } {
  let month = 0;
  closingCash.forEach((amount, index) => {
    if (amount < at(closingCash, month)) month = index;
  });
  return { amount: at(closingCash, month), month };
}

export function firstMonthWhere(values: readonly number[], predicate: (value: number) => boolean): MonthIndex | null {
  const index = values.findIndex(predicate);
  return index === -1 ? null : index;
}

export function buildRatios(
  ledger: Ledger,
  pnlPeriods: readonly (PnlRow & { period: PeriodKey })[],
  periodEnds: readonly (BalanceSheet & { period: PeriodKey })[],
  config: EngineConfig,
): Ratios {
  const { input } = ledger;

  const lowest = lowestCash(ledger.closingCash);
  const limitThen = at(ledger.creditLimit, lowest.month);
  const cashLight: Light =
    lowest.amount + limitThen < 0
      ? 'rood'
      : lowest.amount < input.assumptions.minimumCashBufferCents
        ? 'oranje'
        : 'groen';

  const breakEven = pnlPeriods.map((row) => {
    // Break-even-omzet = vaste lasten (incl. afschrijving en rente) / brutomarge %.
    const coverable = row.revenue > 0 && row.grossMargin > 0;
    const revenueToCover = (costs: Cents) => (coverable ? roundCents((costs * row.revenue) / row.grossMargin) : null);
    const fixedBase = row.fixedCostsTotal + row.staff + row.depreciation + row.interest;
    return {
      period: row.period,
      revenue: revenueToCover(fixedBase),
      revenueInclWithdrawals: ledger.isBv ? null : revenueToCover(fixedBase + row.privateWithdrawals),
      actualRevenue: row.revenue,
    };
  });

  const solvency = periodEnds.map((sheet) => {
    const hasAssets = sheet.totalAssets > 0;
    const value = hasAssets ? sheet.equity / sheet.totalAssets : null;
    return {
      period: sheet.period,
      value,
      valueInclSubordinated: hasAssets ? (sheet.equity + sheet.subordinatedLoans) / sheet.totalAssets : null,
      light: classifyHigherIsBetter(value, config.ratios.solvency),
    };
  });

  // Rentedragende schuld bij de start, als veelvoud van de CFADS in het eerste volle boekjaar.
  const debt =
    sum(input.financing.lines.filter(isLoanLine).map((line) => line.principalCents)) +
    sum(input.financing.existingDebts.map((existing) => existing.outstandingCents));
  const firstFullYear = pnlPeriods.findIndex((row) => row.period === 'y1');
  const cfads = at(
    pnlPeriods.map((row) => row.cfads),
    firstFullYear,
  );
  const debtToCashflow =
    debt === 0
      ? { value: null, debt, cfads, light: 'geen' as const }
      : cfads <= 0
        ? { value: null, debt, cfads, light: 'rood' as const }
        : {
            value: debt / cfads,
            debt,
            cfads,
            light: classifyLowerIsBetter(debt / cfads, config.ratios.debtToCashflow),
          };

  return {
    dscr: dscrByPeriod(pnlPeriods, config),
    lowestCash: { ...lowest, creditLimit: limitThen, light: cashLight },
    breakEven,
    solvency,
    debtToCashflow,
  };
}
