import type { Cents } from '../types/input';
import { roundCents } from './money';
import { at, zeros } from './series';

export interface ShiftResult {
  shifted: Cents[];
  /** Wat pas na de laatste prognosemaand binnenkomt of betaald wordt. */
  beyondHorizon: Cents;
}

/**
 * Verschuift bedragen met een betaaltermijn in dagen. Bij 45 dagen en een rekenmaand van
 * 30 dagen komt de helft één maand later binnen en de andere helft twee maanden later.
 */
export function shiftByDays(amounts: readonly Cents[], days: number, daysPerMonth: number): ShiftResult {
  const shifted = zeros(amounts.length);
  let beyondHorizon = 0;
  const wholeMonths = Math.floor(days / daysPerMonth);
  const lateShare = (days - wholeMonths * daysPerMonth) / daysPerMonth;

  const place = (index: number, amount: Cents) => {
    if (index < shifted.length) shifted[index] = at(shifted, index) + amount;
    else beyondHorizon += amount;
  };

  amounts.forEach((amount, index) => {
    const late = roundCents(amount * lateShare);
    place(index + wholeMonths, amount - late);
    place(index + wholeMonths + 1, late);
  });

  return { shifted, beyondHorizon };
}
