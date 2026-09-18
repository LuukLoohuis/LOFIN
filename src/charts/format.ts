import type { MetricKey } from '../engine';
import { formatCents, formatNumber } from '../lib/format';
import { isRatioMetric } from './theme';

/** Korte as-labels: € 12k in plaats van € 12.500,00. */
export function formatAxisValue(value: number, metric: MetricKey): string {
  if (isRatioMetric(metric)) return formatNumber(value, 1);

  const euros = value / 100;
  const absolute = Math.abs(euros);
  if (absolute >= 1_000_000) return `€ ${formatNumber(euros / 1_000_000, 1)}mln`;
  if (absolute >= 1000) return `€ ${formatNumber(euros / 1000, 0)}k`;
  return `€ ${formatNumber(euros, 0)}`;
}

export function formatMetricValue(value: number | null, metric: MetricKey): string {
  if (value === null) return '—';
  return isRatioMetric(metric) ? formatNumber(value, 2) : formatCents(value);
}

export function formatPercentChange(value: number | null): string {
  if (value === null) return '—';
  const percent = value * 100;
  return `${percent > 0 ? '+' : ''}${formatNumber(percent, 1)}%`;
}
