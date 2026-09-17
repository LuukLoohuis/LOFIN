import type { Timeline } from '../core/calendar';
import { MONTHS_PER_YEAR } from '../core/money';
import { at, cumulative, subtractSeries, zeros } from '../core/series';
import type { Cents, MonthIndex, VatFiling } from '../types/input';
import type { MonthMeta, VatResult } from '../types/result';

const QUARTERS_PER_YEAR = 4;

function filingPeriodKey(meta: MonthMeta, filing: VatFiling): number {
  return filing === 'maand'
    ? meta.year * MONTHS_PER_YEAR + meta.month
    : meta.year * QUARTERS_PER_YEAR + meta.quarter;
}

/**
 * Factuurstelsel: btw telt in de maand van de omzet of de kosten. Per aangifteperiode wordt
 * af te dragen min voorbelasting verrekend in de maand na die periode; een teruggaaf komt in
 * dezelfde maand binnen. Het startmoment hoort bij de periode van de eerste prognosemaand.
 */
export function buildVat(
  output: readonly Cents[],
  input: readonly Cents[],
  timeline: Timeline,
  filing: VatFiling,
): VatResult {
  const length = timeline.months.length;
  const payments = zeros(length);
  const refunds = zeros(length);
  const settlementMonth: (MonthIndex | null)[] = [];
  let periodNet = 0;

  timeline.months.forEach((meta, index) => {
    periodNet += at(output, index) - at(input, index);
    const next = timeline.months[index + 1];
    if (next !== undefined && filingPeriodKey(next, filing) === filingPeriodKey(meta, filing)) return;

    const settledIn = index + 1 < length ? index + 1 : null;
    while (settlementMonth.length <= index) settlementMonth.push(settledIn);
    if (settledIn !== null && periodNet > 0) payments[settledIn] = periodNet;
    if (settledIn !== null && periodNet < 0) refunds[settledIn] = -periodNet;
    periodNet = 0;
  });

  const position = subtractSeries(
    cumulative(subtractSeries(output, input)),
    cumulative(subtractSeries(payments, refunds)),
  );
  return { output: [...output], input: [...input], payments, refunds, position, settlementMonth };
}
