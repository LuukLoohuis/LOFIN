import { BP_PER_UNIT, roundCents } from '../core/money';
import type { Cents } from '../types/input';
import type { TaxBracket } from '../types/config';

/** Vennootschapsbelasting over een belastbare winst, per schijf uit de config. */
export function corporateTax(taxableProfitCents: Cents, brackets: readonly TaxBracket[]): Cents {
  let lowerBound = 0;
  let tax = 0;
  for (const bracket of brackets) {
    const upperBound = bracket.upToCents ?? Number.POSITIVE_INFINITY;
    const inBracket = Math.max(0, Math.min(taxableProfitCents, upperBound) - lowerBound);
    tax += (inBracket * bracket.rateBp) / BP_PER_UNIT;
    lowerBound = upperBound;
  }
  return roundCents(tax);
}
