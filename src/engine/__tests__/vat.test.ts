import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../core/calendar';
import { zeros } from '../core/series';
import { buildVat } from '../plan/vat';

const january = buildTimeline({ year: 2027, month: 1 });

/** 210.000 cent btw over elke prognosemaand; maand 0 is het startmoment. */
function monthlyOutput(length: number, amount: number): number[] {
  return Array.from({ length }, (_, index) => (index === 0 ? 0 : amount));
}

describe('buildVat — kwartaalaangifte', () => {
  const result = buildVat(monthlyOutput(37, 210_000), zeros(37), january, 'kwartaal');

  it('betaalt het kwartaal in de maand erna', () => {
    expect(result.payments.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(result.payments[4]).toBe(630_000);
    expect(result.payments[7]).toBe(630_000);
  });

  it('laat de laatste aangifte als schuld op de balans staan', () => {
    expect(result.settlementMonth[34]).toBeNull();
    expect(result.settlementMonth[1]).toBe(4);
    expect(result.position[36]).toBe(630_000);
  });

  it('telt het startmoment bij het eerste kwartaal', () => {
    const output = zeros(37);
    output[0] = 100_000;
    expect(buildVat(output, zeros(37), january, 'kwartaal').payments[4]).toBe(100_000);
  });
});

describe('buildVat — maandaangifte', () => {
  it('betaalt elke maand de vorige maand', () => {
    const result = buildVat(monthlyOutput(37, 210_000), zeros(37), january, 'maand');
    expect(result.payments[1]).toBe(0);
    expect(result.payments[2]).toBe(210_000);
    expect(result.payments[3]).toBe(210_000);
    expect(result.settlementMonth[35]).toBe(36);
  });
});

describe('buildVat — teruggaaf', () => {
  it('geeft voorbelasting terug in dezelfde maand als de betaling zou vallen', () => {
    const input = zeros(37);
    input[0] = 945_000;
    const result = buildVat(zeros(37), input, january, 'kwartaal');
    expect(result.refunds[4]).toBe(945_000);
    expect(result.payments[4]).toBe(0);
    expect(result.position[4]).toBe(0);
    expect(result.position[0]).toBe(-945_000);
  });

  it('doet niets bij een nulaangifte', () => {
    const result = buildVat(zeros(37), zeros(37), january, 'kwartaal');
    expect(result.payments.every((payment) => payment === 0)).toBe(true);
    expect(result.refunds.every((refund) => refund === 0)).toBe(true);
  });
});

describe('buildVat — verkort eerste kwartaal', () => {
  it('rekent bij een start in november af in januari', () => {
    const november = buildTimeline({ year: 2026, month: 11 });
    const length = november.months.length;
    const result = buildVat(monthlyOutput(length, 100_000), zeros(length), november, 'kwartaal');
    expect(result.payments[3]).toBe(200_000);
    expect(result.settlementMonth[0]).toBe(3);
  });
});
