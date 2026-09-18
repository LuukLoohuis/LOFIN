import { applyBp } from '../core/money';
import type { Bp, Cents, LegalForm } from '../types/input';
import type {
  AccuracyInsight,
  AccuracyMonth,
  AccuracyResult,
  ActualMonth,
  ComparisonBasis,
  ForecastSnapshot,
  MetricKey,
} from '../types/accuracy';
import { classifyDeviation, computeKpis, deviation, deviationPct, type Pair } from './metrics';
import { lastClosedMonth, metricSeriesFromActuals, valueAt } from './series';
import { baselineVersion, firstCashBreach, latestVersion, versionForHorizon } from './versions';
import { buildInsights } from './insights';

export interface AccuracyOptions {
  metric: MetricKey;
  comparison: ComparisonBasis;
  /** Bandbreedte rond de prognose, in basispunten; standaard 1000 (10%). */
  toleranceBp: Bp;
  window: 3 | 6 | 12;
  legalForm: LegalForm;
  horizonMonths: number;
  startMonth: string;
  minimumCashBufferCents: Cents;
}

/**
 * Legt prognose en realisatie naast elkaar: per maand, met een bandbreedte, en met de
 * kengetallen over de laatste afgesloten maanden. Beschrijvend — het zegt wat er gebeurd is,
 * geen advies.
 */
export function buildAccuracy(
  versions: readonly ForecastSnapshot[],
  actuals: readonly ActualMonth[],
  options: AccuracyOptions,
): AccuracyResult {
  const { metric, toleranceBp, horizonMonths, legalForm } = options;
  const baseline = baselineVersion(versions);
  const latest = latestVersion(versions);
  const closedThrough = lastClosedMonth(actuals);
  const actualSeries = metricSeriesFromActuals(actuals, legalForm, horizonMonths);
  const closedMonths = new Set(
    actuals.filter((month) => month.status === 'afgesloten').map((month) => month.month),
  );

  const comparisonFor = (month: number): ForecastSnapshot | null => {
    if (options.comparison === 'baseline') return baseline;
    const horizon = options.comparison === 'horizon1' ? 1 : 3;
    return versionForHorizon(versions, options.startMonth, month, horizon);
  };

  const months: AccuracyMonth[] = [];
  const pairs: Pair[] = [];

  for (let month = 1; month <= horizonMonths; month++) {
    const reference = comparisonFor(month);
    const forecast = reference === null ? null : valueAt(reference.series[metric], month);
    const actual = closedMonths.has(month) ? valueAt(actualSeries[metric], month) : null;
    const reforecast = latest === null ? null : valueAt(latest.series[metric], month);
    const band: [number, number] | null =
      forecast === null ? null : [forecast - tolerance(forecast, toleranceBp), forecast + tolerance(forecast, toleranceBp)];

    const pair = forecast !== null && actual !== null ? { month, forecast, actual } : null;
    if (pair !== null) pairs.push(pair);

    months.push({
      month,
      forecast,
      actual,
      reforecast,
      band,
      deviation: pair === null ? null : deviation(pair),
      deviationPct: pair === null ? null : deviationPct(pair),
      status: pair === null ? null : classifyDeviation(metric, pair, toleranceBp),
      note: reference?.note ?? null,
      closed: closedMonths.has(month),
    });
  }

  const kpis = computeKpis(pairs, options.window, toleranceBp);
  const cashWarning = cashWarningFrom(latest, closedThrough, options);

  const insights: AccuracyInsight[] = buildInsights({
    metric,
    kpis,
    months,
    cashWarning,
    toleranceBp,
  });

  return {
    metric,
    comparison: options.comparison,
    toleranceBp,
    legalForm,
    lastClosedMonth: closedThrough,
    months,
    kpis,
    cashWarning,
    insights,
  };
}

function tolerance(forecast: number, toleranceBp: Bp): number {
  return Math.abs(applyBp(forecast, toleranceBp));
}

function cashWarningFrom(
  latest: ForecastSnapshot | null,
  closedThrough: number | null,
  options: AccuracyOptions,
): AccuracyResult['cashWarning'] {
  if (latest === null) return null;
  const breach = firstCashBreach(
    latest.series.eindsaldo,
    options.minimumCashBufferCents,
    (closedThrough ?? 0) + 1,
  );
  return breach === null ? null : { ...breach, buffer: options.minimumCashBufferCents };
}
