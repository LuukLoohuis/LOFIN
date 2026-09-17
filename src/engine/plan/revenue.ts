import type { Timeline } from '../core/calendar';
import { growthMultiplier, MONTHS_PER_YEAR, roundCents, sum } from '../core/money';
import { at } from '../core/series';
import type { AssumptionsInput, Bp, Cents, RevenueModel } from '../types/input';
import type { Issue } from '../types/result';
import { periodGrowthFactor } from './growth';

/** Een seizoensgewicht van 100 is een gemiddelde maand. */
export const SEASONALITY_UNIT = 100;
export const SEASONALITY_TOTAL = SEASONALITY_UNIT * MONTHS_PER_YEAR;

export function baseMonthlyRevenue(model: RevenueModel): number {
  switch (model.kind) {
    case 'uurtarief':
      return model.hourlyRateCents * model.billableHoursPerMonth;
    case 'opdrachten':
      return model.jobsPerMonth * model.averageJobValueCents;
    case 'maandbedrag':
      return model.monthlyAmountCents;
  }
}

/**
 * Omzet per maand (index 0 = startmoment, zonder omzet).
 * Bij 'maandbedrag' groeit de omzet de eerste `rampUpMonths` maanden elke maand; daarna blijft
 * dat niveau staan en groeit het per boekjaar. Jaar 2 rekent dus vanaf het decemberniveau van
 * jaar 1, niet vanaf het jaartotaal: anders zou de omzet in januari dalen.
 */
export function buildRevenue(
  assumptions: AssumptionsInput,
  timeline: Timeline,
  rampUpMonths: number,
  scenarioDeltaBp: Bp,
): Cents[] {
  const { revenue: model, seasonality, revenueGrowthBp } = assumptions;
  const base = baseMonthlyRevenue(model);
  const monthlyGrowth = model.kind === 'maandbedrag' ? growthMultiplier(model.monthlyGrowthBp) : 1;
  const scenario = growthMultiplier(scenarioDeltaBp);

  return timeline.months.map((meta) => {
    if (meta.index === 0) return 0;
    const rampUp = monthlyGrowth ** (Math.min(meta.index, rampUpMonths) - 1);
    const weight = at(seasonality, meta.month - 1) / SEASONALITY_UNIT;
    return roundCents(base * rampUp * periodGrowthFactor(meta.period, revenueGrowthBp) * weight * scenario);
  });
}

export function validateSeasonality(weights: readonly number[]): Issue | null {
  const total = sum(weights);
  const valid =
    weights.length === MONTHS_PER_YEAR &&
    weights.every((weight) => Number.isInteger(weight) && weight >= 0) &&
    total === SEASONALITY_TOTAL;
  if (valid) return null;
  return {
    code: 'SEASONALITY_INVALID',
    severity: 'error',
    path: 'assumptions.seasonality',
    params: { count: weights.length, sum: total },
  };
}
