import { at, zeros } from '../core/series';
import type { Cents, LegalForm, MonthIndex } from '../types/input';
import type { ActualCategory, ActualMonth, MetricKey, MetricSeries } from '../types/accuracy';
import type { PlanResult } from '../types/result';

export const METRIC_KEYS: readonly MetricKey[] = ['omzet', 'brutomarge', 'vasteKosten', 'eindsaldo', 'dscr12'];

const FIXED_COST_CATEGORIES: readonly ActualCategory[] = [
  'huur',
  'vervoer',
  'verzekeringen',
  'telefoon_software',
  'accountant',
  'marketing',
  'overig',
];

export const ROLLING_WINDOW = 12;

/**
 * DSCR over een voortschrijdend jaar. Zolang er nog geen twaalf maanden zijn, rekenen we met
 * wat er is; anders zou de ratio pas na een jaar iets laten zien.
 */
export function rollingDscr(cfads: readonly number[], debtService: readonly number[], closedThrough: number): (number | null)[] {
  return cfads.map((_, month) => {
    if (month === 0 || month > closedThrough) return null;
    const first = Math.max(1, month - ROLLING_WINDOW + 1);
    let cash = 0;
    let service = 0;
    for (let index = first; index <= month; index++) {
      cash += at(cfads, index);
      service += at(debtService, index);
    }
    return service === 0 ? null : cash / service;
  });
}

/** De reeksen van een doorgerekend plan, klaar om vast te zetten als versie. */
export function metricSeriesFromResult(result: PlanResult): MetricSeries {
  const months = result.pnl.monthly;
  const cfads = months.map((row) => row.cfads);
  const debtService = months.map((row) => row.debtService);

  return {
    omzet: months.map((row, month) => (month === 0 ? null : row.revenue)),
    brutomarge: months.map((row, month) => (month === 0 ? null : row.grossMargin)),
    vasteKosten: months.map((row, month) => (month === 0 ? null : row.fixedCostsTotal + row.staff)),
    eindsaldo: result.cashflow.monthly.map((row) => row.closingCash),
    dscr12: rollingDscr(cfads, debtService, months.length - 1),
  };
}

/** Hetzelfde, maar uit de ingevoerde realisatie. Alleen afgesloten maanden tellen mee. */
export function metricSeriesFromActuals(
  actuals: readonly ActualMonth[],
  legalForm: LegalForm,
  horizonMonths: number,
): MetricSeries {
  const length = horizonMonths + 1;
  const closed = actuals.filter((month) => month.status === 'afgesloten');
  const closedThrough = closed.reduce((last, month) => Math.max(last, month.month), 0);

  const byMonth = new Map<MonthIndex, ActualMonth>();
  for (const month of closed) byMonth.set(month.month, month);

  const value = (month: MonthIndex, category: ActualCategory): Cents => byMonth.get(month)?.values[category] ?? 0;
  const fixedCosts = (month: MonthIndex) =>
    FIXED_COST_CATEGORIES.reduce((total, category) => total + value(month, category), 0) + value(month, 'personeel');

  const cfads = zeros(length).map((_, month) => {
    if (!byMonth.has(month)) return 0;
    const operating = value(month, 'omzet') - value(month, 'inkoopwaarde') - fixedCosts(month);
    // Afschrijving valt tegen elkaar weg in de kasstroom; privé-opnamen niet.
    return legalForm === 'bv' ? operating : operating - value(month, 'priveOpnamen');
  });
  const debtService = zeros(length).map((_, month) =>
    byMonth.has(month) ? value(month, 'rente') + value(month, 'aflossing') : 0,
  );

  const closedOrNull = <T>(month: MonthIndex, compute: () => T): T | null =>
    byMonth.has(month) ? compute() : null;

  return {
    omzet: zeros(length).map((_, month) => closedOrNull(month, () => value(month, 'omzet'))),
    brutomarge: zeros(length).map((_, month) =>
      closedOrNull(month, () => value(month, 'omzet') - value(month, 'inkoopwaarde')),
    ),
    vasteKosten: zeros(length).map((_, month) => closedOrNull(month, () => fixedCosts(month))),
    eindsaldo: zeros(length).map((_, month) => closedOrNull(month, () => value(month, 'eindsaldo'))),
    dscr12: rollingDscr(cfads, debtService, closedThrough).map((ratio, month) =>
      byMonth.has(month) ? ratio : null,
    ),
  };
}

/** Waarde op een positie; buiten de reeks is er simpelweg geen waarde. */
export function valueAt(series: readonly (number | null)[], index: number): number | null {
  return series[index] ?? null;
}

export function lastClosedMonth(actuals: readonly ActualMonth[]): MonthIndex | null {
  const closed = actuals.filter((month) => month.status === 'afgesloten').map((month) => month.month);
  return closed.length === 0 ? null : Math.max(...closed);
}
