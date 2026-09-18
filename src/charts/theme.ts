import type { MetricKey } from '../engine';

/**
 * Kleurenblindvriendelijk: blauw, turquoise en amber zijn ook zonder kleur te onderscheiden.
 * Prognose en realisatie verschillen bovendien in lijnstijl, niet alleen in kleur.
 */
export const chartColors = {
  actual: '#1d4ed8',
  baseline: '#64748b',
  reforecast: '#0f766e',
  band: '#cbd5e1',
  within: '#94a3b8',
  favourable: '#0f766e',
  unfavourable: '#b45309',
  grid: '#e2e8f0',
  marker: '#0f172a',
} as const;

export const lineStyles = {
  baseline: '6 4',
  reforecast: '2 3',
} as const;

export const METRIC_LABELS: Record<MetricKey, string> = {
  omzet: 'Omzet',
  brutomarge: 'Brutomarge',
  vasteKosten: 'Vaste kosten',
  eindsaldo: 'Liquide middelen (eindsaldo)',
  dscr12: 'DSCR (voortschrijdend jaar)',
};

/** De DSCR is een verhouding, de rest bedragen in centen. */
export function isRatioMetric(metric: MetricKey): boolean {
  return metric === 'dscr12';
}
