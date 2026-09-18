import { BP_PER_UNIT } from '../core/money';
import type { Bp, MonthIndex } from '../types/input';
import type { AccuracyKpis, DeviationStatus, MetricKey } from '../types/accuracy';

export interface Pair {
  month: MonthIndex;
  forecast: number;
  actual: number;
}

/** Voor kosten is een meevaller juist een lager getal. */
const LOWER_IS_BETTER: ReadonlySet<MetricKey> = new Set<MetricKey>(['vasteKosten']);

export function deviation(pair: Pair): number {
  return pair.actual - pair.forecast;
}

/**
 * Afwijking als deel van de prognose. We delen door de absolute prognose, zodat een minteken
 * altijd 'lager dan verwacht' betekent — ook bij een negatief verwacht kassaldo.
 */
export function deviationPct(pair: Pair): number | null {
  return pair.forecast === 0 ? null : deviation(pair) / Math.abs(pair.forecast);
}

/**
 * WAPE in plaats van MAPE: een seizoensbedrijf heeft stille maanden, en daar blaast MAPE
 * elke afwijking op.
 */
export function wape(pairs: readonly Pair[]): number | null {
  const actualTotal = pairs.reduce((total, pair) => total + Math.abs(pair.actual), 0);
  if (actualTotal === 0) return null;
  return pairs.reduce((total, pair) => total + Math.abs(deviation(pair)), 0) / actualTotal;
}

export function forecastAccuracy(pairs: readonly Pair[]): number | null {
  const value = wape(pairs);
  return value === null ? null : Math.max(0, 1 - value);
}

/** Positief betekent: de prognose lag structureel te hoog. */
export function bias(pairs: readonly Pair[]): number | null {
  const actualTotal = pairs.reduce((total, pair) => total + Math.abs(pair.actual), 0);
  if (actualTotal === 0) return null;
  return pairs.reduce((total, pair) => total + (pair.forecast - pair.actual), 0) / actualTotal;
}

export function mad(pairs: readonly Pair[]): number {
  if (pairs.length === 0) return 0;
  return pairs.reduce((total, pair) => total + Math.abs(deviation(pair)), 0) / pairs.length;
}

/** Loopt de prognose steeds dezelfde kant op? Boven |4| is dat geen toeval meer. */
export function trackingSignal(pairs: readonly Pair[]): number | null {
  const spread = mad(pairs);
  if (spread === 0) return null;
  return pairs.reduce((total, pair) => total + deviation(pair), 0) / spread;
}

/** Aandeel maanden binnen de bandbreedte; de grens telt mee. */
export function hitRate(pairs: readonly Pair[], toleranceBp: Bp): number | null {
  const usable = pairs.filter((pair) => pair.forecast !== 0);
  if (usable.length === 0) return null;
  const within = usable.filter((pair) => withinTolerance(pair, toleranceBp)).length;
  return within / usable.length;
}

/** Hele getallen vergelijken: precies op de grens hoort er nog bij. */
export function withinTolerance(pair: Pair, toleranceBp: Bp): boolean {
  return Math.abs(deviation(pair)) * BP_PER_UNIT <= toleranceBp * Math.abs(pair.forecast);
}

export function isFavourable(metric: MetricKey, value: number): boolean {
  return LOWER_IS_BETTER.has(metric) ? value < 0 : value > 0;
}

export function classifyDeviation(metric: MetricKey, pair: Pair, toleranceBp: Bp): DeviationStatus | null {
  if (pair.forecast === 0) return null;
  if (withinTolerance(pair, toleranceBp)) return 'binnen';
  return isFavourable(metric, deviation(pair)) ? 'gunstig' : 'ongunstig';
}

export const MINIMUM_CLOSED_MONTHS = 3;
export const TRACKING_SIGNAL_LIMIT = 4;

/** De kengetallen over de laatste `window` afgesloten maanden. */
export function computeKpis(
  pairs: readonly Pair[],
  window: AccuracyKpis['window'],
  toleranceBp: Bp,
): AccuracyKpis | { insufficientData: true; closedMonths: number } {
  const recent = pairs.slice(-window);
  if (recent.length < MINIMUM_CLOSED_MONTHS) return { insufficientData: true, closedMonths: recent.length };

  const wapeValue = wape(recent) ?? 0;
  const signal = trackingSignal(recent);
  return {
    window,
    closedMonths: recent.length,
    accuracy: Math.max(0, 1 - wapeValue),
    wape: wapeValue,
    bias: bias(recent) ?? 0,
    mad: mad(recent),
    trackingSignal: signal,
    trackingWarning: signal !== null && Math.abs(signal) > TRACKING_SIGNAL_LIMIT,
    hitRate: hitRate(recent, toleranceBp) ?? 0,
  };
}
