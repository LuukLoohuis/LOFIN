import type { Bp, Cents } from '../types/input';

export const BP_PER_UNIT = 10_000;
export const MONTHS_PER_YEAR = 12;

/**
 * Rondt af op hele centen zoals Excel's AFRONDEN: eerst terug naar 15 significante cijfers
 * (zodat 0,1 + 0,2 geen 0,30000000000000004 blijft), daarna half van nul af.
 * Math.round(-2.5) geeft -2; Excel geeft -3.
 */
export function roundCents(value: number): Cents {
  const cleaned = Number(value.toPrecision(15));
  const rounded = Math.sign(cleaned) * Math.round(Math.abs(cleaned));
  return rounded === 0 ? 0 : rounded;
}

export function applyBp(amount: Cents, bp: Bp): Cents {
  return roundCents((amount * bp) / BP_PER_UNIT);
}

/** 500 bp → 1,05. */
export function growthMultiplier(bp: Bp): number {
  return 1 + bp / BP_PER_UNIT;
}

/**
 * Deel `part` (vanaf 1) van `parts` gelijke delen, cumulatief afgerond: het verschil tussen
 * twee afgeronde tussenstanden. De delen tellen daardoor exact op tot het afgeronde totaal,
 * worden nooit negatief en laten zich in Excel als één formule schrijven.
 */
export function cumulativeShare(total: number, part: number, parts: number): Cents {
  return roundCents((total * part) / parts) - roundCents((total * (part - 1)) / parts);
}

/** Maandrente over een saldo, zonder omweg via een onnauwkeurige 0,07/12. */
export function monthlyInterest(balance: Cents, annualRateBp: Bp): Cents {
  return roundCents((balance * annualRateBp) / (BP_PER_UNIT * MONTHS_PER_YEAR));
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}
