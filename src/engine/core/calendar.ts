import type { MonthIndex } from '../types/input';
import type { FiscalPeriod, MonthMeta, PeriodKey, YearKey } from '../types/result';
import { MONTHS_PER_YEAR } from './money';

export interface YearMonth {
  year: number;
  /** 1–12 */
  month: number;
}

export interface Timeline {
  start: YearMonth;
  horizonMonths: number;
  /** Index 0 is het startmoment, daarna één regel per prognosemaand. */
  months: MonthMeta[];
  periods: FiscalPeriod[];
}

/** De prognose beslaat altijd drie volle boekjaren, eventueel voorafgegaan door een startperiode. */
export const YEAR_KEYS: readonly YearKey[] = ['y1', 'y2', 'y3'];

const YEAR_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseYearMonth(value: string): YearMonth | null {
  const match = YEAR_MONTH.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function addMonths(start: YearMonth, offset: number): YearMonth {
  const monthsSinceYearZero = start.year * MONTHS_PER_YEAR + start.month - 1 + offset;
  return {
    year: Math.floor(monthsSinceYearZero / MONTHS_PER_YEAR),
    month: (monthsSinceYearZero % MONTHS_PER_YEAR) + 1,
  };
}

export function quarterOf(month: number): 1 | 2 | 3 | 4 {
  return (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

/**
 * Boekjaren lopen van januari tot en met december. Start je niet in januari, dan komt de
 * rest van dat jaar als verkorte startperiode vóór de drie volle boekjaren.
 */
export function buildTimeline(start: YearMonth): Timeline {
  const stubMonths = (MONTHS_PER_YEAR + 1 - start.month) % MONTHS_PER_YEAR;
  const firstFullYear = stubMonths > 0 ? start.year + 1 : start.year;

  const yearPeriods = YEAR_KEYS.map(
    (key, offset): FiscalPeriod => ({
      key,
      calendarYear: firstFullYear + offset,
      firstMonth: stubMonths + offset * MONTHS_PER_YEAR + 1,
      lastMonth: stubMonths + (offset + 1) * MONTHS_PER_YEAR,
      months: MONTHS_PER_YEAR,
    }),
  );
  const periods: FiscalPeriod[] =
    stubMonths > 0
      ? [{ key: 'start', calendarYear: start.year, firstMonth: 1, lastMonth: stubMonths, months: stubMonths }, ...yearPeriods]
      : yearPeriods;

  const months: MonthMeta[] = [monthMeta(start, 0, stubMonths > 0 ? 'start' : 'y1')];
  for (const period of periods) {
    for (let index = period.firstMonth; index <= period.lastMonth; index++) {
      months.push(monthMeta(start, index, period.key));
    }
  }

  return { start, horizonMonths: stubMonths + YEAR_KEYS.length * MONTHS_PER_YEAR, months, periods };
}

/** De eerste periode telt het startmoment mee. */
export function periodRange(period: FiscalPeriod, isFirst: boolean): { first: MonthIndex; last: MonthIndex } {
  return { first: isFirst ? 0 : period.firstMonth, last: period.lastMonth };
}

function monthMeta(start: YearMonth, index: MonthIndex, period: PeriodKey): MonthMeta {
  const date = addMonths(start, Math.max(0, index - 1));
  return { index, year: date.year, month: date.month, quarter: quarterOf(date.month), period };
}
