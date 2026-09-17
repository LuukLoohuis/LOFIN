import { describe, expect, it } from 'vitest';
import { sum } from '../core/money';
import { shiftByDays } from '../core/timing';

describe('shiftByDays', () => {
  it('laat bedragen staan bij directe betaling', () => {
    expect(shiftByDays([100, 200, 300], 0, 30)).toEqual({ shifted: [100, 200, 300], beyondHorizon: 0 });
  });

  it('schuift een hele maand op en houdt bij wat na de horizon valt', () => {
    expect(shiftByDays([100, 200, 300], 30, 30)).toEqual({ shifted: [0, 100, 200], beyondHorizon: 300 });
  });

  it('verdeelt 45 dagen over twee maanden', () => {
    const { shifted, beyondHorizon } = shiftByDays([1000, 0, 0, 0], 45, 30);
    expect(shifted).toEqual([0, 500, 500, 0]);
    expect(beyondHorizon).toBe(0);
  });

  it('bewaart de centen bij een oneven bedrag', () => {
    const { shifted, beyondHorizon } = shiftByDays([101, 0, 0, 0], 45, 30);
    expect(shifted).toEqual([0, 50, 51, 0]);
    expect(sum(shifted) + beyondHorizon).toBe(101);
  });

  it('schuift ook over meerdere maanden', () => {
    const { shifted, beyondHorizon } = shiftByDays([600, 0, 0, 0, 0], 75, 30);
    expect(shifted).toEqual([0, 0, 300, 300, 0]);
    expect(beyondHorizon).toBe(0);
  });
});
