import type { AccuracyResult, MetricKey, MonthMeta } from '../../engine';
import { formatMetricValue, formatPercentChange } from '../../charts/format';

export interface AccuracyPoint {
  month: number;
  label: string;
  forecast: number | null;
  actual: number | null;
  reforecast: number | null;
  band: [number, number] | null;
  deviation: number | null;
  deviationPct: number | null;
  status: AccuracyResult['months'][number]['status'];
  note: string | null;
  /** Losse reeksen per kleur, zodat de staaf zijn betekenis houdt. */
  within: number | null;
  favourable: number | null;
  unfavourable: number | null;
}

const MONTH_ABBREVIATIONS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function monthLabel(meta: MonthMeta | undefined, month: number): string {
  if (meta === undefined) return `m${month}`;
  return `${MONTH_ABBREVIATIONS[meta.month - 1] ?? ''} ${String(meta.year).slice(2)}`;
}

export function toChartData(accuracy: AccuracyResult, months: readonly MonthMeta[]): AccuracyPoint[] {
  return accuracy.months.map((row) => {
    const percentage = row.deviationPct;
    return {
      month: row.month,
      label: monthLabel(months[row.month], row.month),
      forecast: row.forecast,
      actual: row.actual,
      reforecast: row.reforecast,
      band: row.band,
      deviation: row.deviation,
      deviationPct: percentage,
      status: row.status,
      note: row.note,
      within: row.status === 'binnen' ? percentage : null,
      favourable: row.status === 'gunstig' ? percentage : null,
      unfavourable: row.status === 'ongunstig' ? percentage : null,
    };
  });
}

/** Eén zin die zegt wat er in de grafiek te zien is, voor wie hem niet ziet. */
export function describeAccuracy(accuracy: AccuracyResult, metricLabel: string): string {
  const closed = accuracy.months.filter((row) => row.actual !== null);
  if (closed.length === 0) return `Nog geen afgesloten maanden om ${metricLabel.toLowerCase()} mee te vergelijken.`;

  const outside = closed.filter((row) => row.status !== 'binnen').length;
  const first = closed[0];
  const last = closed.at(-1);
  return [
    `${metricLabel} over ${closed.length} afgesloten maanden.`,
    first === undefined
      ? ''
      : `De eerste maand kwam uit op ${formatMetricValue(first.actual, accuracy.metric)} tegenover ${formatMetricValue(first.forecast, accuracy.metric)} begroot.`,
    last === undefined
      ? ''
      : `De laatste maand ${formatMetricValue(last.actual, accuracy.metric)} tegenover ${formatMetricValue(last.forecast, accuracy.metric)} (${formatPercentChange(last.deviationPct)}).`,
    `${outside} van de ${closed.length} maanden viel buiten de bandbreedte.`,
  ]
    .filter((sentence) => sentence !== '')
    .join(' ');
}

export function accuracyTable(
  points: readonly AccuracyPoint[],
  metric: MetricKey,
): { columns: string[]; rows: string[][] } {
  return {
    columns: ['Maand', 'Prognose', 'Realisatie', 'Bijgesteld', 'Afwijking', 'Afwijking %'],
    rows: points.map((point) => [
      point.label,
      formatMetricValue(point.forecast, metric),
      formatMetricValue(point.actual, metric),
      formatMetricValue(point.reforecast, metric),
      formatMetricValue(point.deviation, metric),
      formatPercentChange(point.deviationPct),
    ]),
  };
}
