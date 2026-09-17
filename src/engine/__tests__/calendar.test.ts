import { describe, expect, it } from 'vitest';
import { addMonths, buildTimeline, parseYearMonth, periodRange, quarterOf } from '../core/calendar';

describe('parseYearMonth', () => {
  it('leest een geldige maand', () => {
    expect(parseYearMonth('2027-01')).toEqual({ year: 2027, month: 1 });
    expect(parseYearMonth('2026-12')).toEqual({ year: 2026, month: 12 });
  });

  it('weigert onzin', () => {
    expect(parseYearMonth('2027-13')).toBeNull();
    expect(parseYearMonth('2027-00')).toBeNull();
    expect(parseYearMonth('januari')).toBeNull();
  });
});

describe('addMonths', () => {
  it('telt maanden op over de jaargrens', () => {
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({ year: 2027, month: 2 });
    expect(addMonths({ year: 2027, month: 1 }, 0)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2027, month: 1 }, 24)).toEqual({ year: 2029, month: 1 });
  });
});

describe('quarterOf', () => {
  it('bepaalt het kwartaal', () => {
    expect([1, 3, 4, 7, 10, 12].map(quarterOf)).toEqual([1, 1, 2, 3, 4, 4]);
  });
});

describe('buildTimeline', () => {
  it('geeft precies drie boekjaren bij een start in januari', () => {
    const timeline = buildTimeline({ year: 2027, month: 1 });
    expect(timeline.horizonMonths).toBe(36);
    expect(timeline.months).toHaveLength(37);
    expect(timeline.periods.map((period) => period.key)).toEqual(['y1', 'y2', 'y3']);
    expect(timeline.periods.map((period) => period.calendarYear)).toEqual([2027, 2028, 2029]);
    expect(timeline.months[0]).toEqual({ index: 0, year: 2027, month: 1, quarter: 1, period: 'y1' });
    expect(timeline.months[12]).toMatchObject({ year: 2027, month: 12, quarter: 4, period: 'y1' });
  });

  it('zet een verkorte startperiode voor de boekjaren bij een start in oktober', () => {
    const timeline = buildTimeline({ year: 2026, month: 10 });
    expect(timeline.horizonMonths).toBe(39);
    expect(timeline.periods.map((period) => period.key)).toEqual(['start', 'y1', 'y2', 'y3']);
    expect(timeline.periods[0]).toEqual({
      key: 'start',
      calendarYear: 2026,
      firstMonth: 1,
      lastMonth: 3,
      months: 3,
    });
    expect(timeline.periods[1]).toMatchObject({ key: 'y1', calendarYear: 2027, firstMonth: 4, lastMonth: 15 });
    expect(timeline.months[0]?.period).toBe('start');
    expect(timeline.months[4]).toMatchObject({ year: 2027, month: 1, period: 'y1' });
    expect(timeline.months.at(-1)).toMatchObject({ year: 2029, month: 12, period: 'y3' });
  });

  it('rekt de horizon op tot 47 maanden bij een start in februari', () => {
    const timeline = buildTimeline({ year: 2027, month: 2 });
    expect(timeline.horizonMonths).toBe(47);
    expect(timeline.periods[0]).toMatchObject({ key: 'start', months: 11 });
  });
});

describe('periodRange', () => {
  it('telt het startmoment mee in de eerste periode', () => {
    const timeline = buildTimeline({ year: 2027, month: 1 });
    const first = timeline.periods[0];
    if (first === undefined) throw new Error('geen periode');
    expect(periodRange(first, true)).toEqual({ first: 0, last: 12 });
    expect(periodRange(first, false)).toEqual({ first: 1, last: 12 });
  });
});
