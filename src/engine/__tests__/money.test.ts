import { describe, expect, it } from 'vitest';
import { applyBp, cumulativeShare, growthMultiplier, monthlyInterest, roundCents, sum } from '../core/money';

describe('roundCents', () => {
  it('rondt half van nul af, zoals Excel', () => {
    expect(roundCents(2.5)).toBe(3);
    expect(roundCents(-2.5)).toBe(-3);
    expect(roundCents(2.49)).toBe(2);
    expect(roundCents(-2.49)).toBe(-2);
  });

  it('levert nooit min nul op', () => {
    expect(Object.is(roundCents(-0.4), 0)).toBe(true);
    expect(Object.is(roundCents(0), 0)).toBe(true);
  });

  it('corrigeert drijvende-kommaruis voordat het afrondt', () => {
    // Zonder correctie zou dit 2 worden, terwijl Excel 3 geeft.
    expect(roundCents(2.4999999999999996)).toBe(3);
    expect(roundCents(0.1 + 0.2)).toBe(0);
  });
});

describe('applyBp', () => {
  it('rekent met basispunten', () => {
    expect(applyBp(1_250_000, 3500)).toBe(437_500);
    expect(applyBp(101, 2100)).toBe(21);
    expect(applyBp(1_000_000, 0)).toBe(0);
  });
});

describe('growthMultiplier', () => {
  it('maakt van basispunten een factor', () => {
    expect(growthMultiplier(500)).toBeCloseTo(1.05, 10);
    expect(growthMultiplier(-2000)).toBeCloseTo(0.8, 10);
  });
});

describe('cumulativeShare', () => {
  it('verdeelt een jaarbedrag exact over twaalf maanden', () => {
    const parts = Array.from({ length: 12 }, (_, index) => cumulativeShare(2_000_000, index + 1, 12));
    expect(sum(parts)).toBe(2_000_000);
    expect(parts.slice(0, 3)).toEqual([166_667, 166_666, 166_667]);
  });

  it('houdt delen van een klein bedrag niet-negatief', () => {
    const parts = Array.from({ length: 12 }, (_, index) => cumulativeShare(7, index + 1, 12));
    expect(sum(parts)).toBe(7);
    expect(parts.every((part) => part >= 0)).toBe(true);
  });
});

describe('monthlyInterest', () => {
  it('rekent de maandrente over het saldo', () => {
    expect(monthlyInterest(5_000_000, 700)).toBe(29_167);
    expect(monthlyInterest(0, 700)).toBe(0);
    expect(monthlyInterest(5_000_000, 0)).toBe(0);
  });
});

describe('sum', () => {
  it('telt een lege reeks op tot nul', () => {
    expect(sum([])).toBe(0);
    expect(sum([1, -2, 3])).toBe(2);
  });
});
