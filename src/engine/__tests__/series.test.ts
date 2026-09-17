import { describe, expect, it } from 'vitest';
import { addSeries, at, cumulative, subtractSeries, sumRange, zeros } from '../core/series';

describe('at', () => {
  it('geeft nul buiten de reeks', () => {
    expect(at([1, 2, 3], 1)).toBe(2);
    expect(at([1, 2, 3], -1)).toBe(0);
    expect(at([1, 2, 3], 9)).toBe(0);
  });
});

describe('addSeries', () => {
  it('telt op per positie en volgt de lengte van de eerste reeks', () => {
    expect(addSeries([1, 2, 3], [10, 10], [100])).toEqual([111, 12, 3]);
    expect(addSeries([1, 2])).toEqual([1, 2]);
  });
});

describe('subtractSeries', () => {
  it('trekt af per positie', () => {
    expect(subtractSeries([10, 10, 10], [1, 2])).toEqual([9, 8, 10]);
  });
});

describe('cumulative', () => {
  it('loopt op', () => {
    expect(cumulative([1, 2, 3])).toEqual([1, 3, 6]);
    expect(cumulative([])).toEqual([]);
  });
});

describe('sumRange', () => {
  it('telt op van en tot en met', () => {
    expect(sumRange([1, 2, 3, 4], 1, 2)).toBe(5);
    expect(sumRange([1, 2, 3, 4], 2, 99)).toBe(7);
    expect(sumRange([1, 2, 3, 4], 3, 1)).toBe(0);
  });
});

describe('zeros', () => {
  it('maakt een reeks nullen', () => {
    expect(zeros(3)).toEqual([0, 0, 0]);
    expect(zeros(0)).toEqual([]);
  });
});
