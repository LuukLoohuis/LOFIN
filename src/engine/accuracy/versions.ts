import { addMonths, parseYearMonth } from '../core/calendar';
import { EngineInputError } from '../core/errors';
import { at } from '../core/series';
import type { Cents, MonthIndex } from '../types/input';
import type { EvolutionPoint, ForecastSnapshot, MetricKey } from '../types/accuracy';

/** De nieuwste versie: het hoogste versienummer. */
export function latestVersion(versions: readonly ForecastSnapshot[]): ForecastSnapshot | null {
  return versions.reduce<ForecastSnapshot | null>(
    (latest, version) => (latest === null || version.versionNo > latest.versionNo ? version : latest),
    null,
  );
}

export function baselineVersion(versions: readonly ForecastSnapshot[]): ForecastSnapshot | null {
  return versions.find((version) => version.kind === 'baseline') ?? null;
}

const DAYS_PER_MONTH: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Laatste dag van een prognosemaand, als 'YYYY-MM-DD'. Zonder klok, dus reproduceerbaar.
 * Een maandnummer mag ook vóór de start liggen; dat heb je nodig om terug te kijken.
 */
export function monthEndDate(startMonth: string, month: MonthIndex): string {
  const start = parseYearMonth(startMonth);
  if (start === null) throw new EngineInputError(`Ongeldige startmaand: '${startMonth}'`);
  const target = addMonths(start, month - 1);
  const lastDay = target.month === 2 && isLeapYear(target.year) ? 29 : at(DAYS_PER_MONTH, target.month - 1);
  return `${target.year}-${String(target.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Hoe goed was de prognose die je een maand (of kwartaal) van tevoren maakte? We pakken de
 * nieuwste versie die minstens `horizonMonths` vóór het einde van die maand bestond.
 */
export function versionForHorizon(
  versions: readonly ForecastSnapshot[],
  startMonth: string,
  month: MonthIndex,
  horizonMonths: number,
): ForecastSnapshot | null {
  const deadline = monthEndDate(startMonth, month - horizonMonths);
  const eligible = versions.filter((version) => version.createdOn <= deadline);
  return latestVersion(eligible);
}

/** Hoe de verwachting voor één maand zich door de versies heen ontwikkelde. */
export function forecastEvolution(
  versions: readonly ForecastSnapshot[],
  metric: MetricKey,
  month: MonthIndex,
): EvolutionPoint[] {
  return [...versions]
    .sort((left, right) => left.versionNo - right.versionNo)
    .map((version) => ({
      versionNo: version.versionNo,
      createdOn: version.createdOn,
      kind: version.kind,
      value: version.series[metric][month] ?? null,
      note: version.note,
    }));
}

/** Eerste maand waarin het saldo onder de buffer zakt; nul is ook onder de buffer. */
export function firstCashBreach(
  series: readonly (number | null)[],
  bufferCents: Cents,
  fromMonth: MonthIndex,
): { month: MonthIndex; balance: Cents } | null {
  const first = Math.max(1, fromMonth);
  for (const [month, balance] of series.entries()) {
    if (month >= first && balance !== null && balance < bufferCents) return { month, balance };
  }
  return null;
}
