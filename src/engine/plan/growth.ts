import { growthMultiplier } from '../core/money';
import type { YearGrowth } from '../types/input';
import type { PeriodKey } from '../types/result';

/** Startperiode en boekjaar 1 zijn de basis; jaar 2 en 3 stapelen hun groei daarop. */
export function periodGrowthFactor(period: PeriodKey, growth: YearGrowth): number {
  switch (period) {
    case 'y2':
      return growthMultiplier(growth.y2);
    case 'y3':
      return growthMultiplier(growth.y2) * growthMultiplier(growth.y3);
    default:
      return 1;
  }
}
