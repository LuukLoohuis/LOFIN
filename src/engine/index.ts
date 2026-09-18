export { buildTimeline, parseYearMonth, quarterOf, type Timeline, type YearMonth } from './core/calendar';
export { EngineInputError } from './core/errors';
export { applyBp, cumulativeShare, monthlyInterest, roundCents } from './core/money';
export { shiftByDays } from './core/timing';
export { buildAccuracy, type AccuracyOptions } from './accuracy/buildAccuracy';
export {
  bias,
  classifyDeviation,
  computeKpis,
  deviation,
  deviationPct,
  forecastAccuracy,
  hitRate,
  isFavourable,
  mad,
  MINIMUM_CLOSED_MONTHS,
  trackingSignal,
  TRACKING_SIGNAL_LIMIT,
  wape,
  type Pair,
} from './accuracy/metrics';
export {
  lastClosedMonth,
  METRIC_KEYS,
  metricSeriesFromActuals,
  metricSeriesFromResult,
  rollingDscr,
  valueAt,
} from './accuracy/series';
export {
  baselineVersion,
  firstCashBreach,
  forecastEvolution,
  latestVersion,
  monthEndDate,
  versionForHorizon,
} from './accuracy/versions';
export { calculatePlan } from './plan/calculatePlan';
export { buildChecklist } from './plan/completeness';
export { estimateWorkingCapital } from './plan/financingNeed';
export { annuityPayment, buildSchedule } from './plan/loans';
export { baseMonthlyRevenue, SEASONALITY_TOTAL, SEASONALITY_UNIT, validateSeasonality } from './plan/revenue';
export { corporateTax } from './plan/tax';
export { ENGINE_VERSION } from './version';
export type * from './types/accuracy';
export type * from './types/config';
export type * from './types/input';
export type * from './types/result';
