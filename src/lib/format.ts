import { roundCents } from '../engine';
import type { Bp, Cents } from '../engine';

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const euroWhole = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const decimal = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCents(cents: Cents): string {
  // Zonder deze stap wordt een omgedraaid nulbedrag '€ -0,00'.
  return euro.format(cents === 0 ? 0 : cents / 100);
}

/** Zonder centen: voor tabellen en grafieken waar de cent niet uitmaakt. */
export function formatCentsWhole(cents: Cents): string {
  return euroWhole.format(cents / 100);
}

/** Voor invoervelden: '35.000,00' zonder euroteken. */
export function formatCentsInput(cents: Cents): string {
  return decimal.format(cents / 100);
}

export function formatPercent(bp: Bp, decimals = 2): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(bp / 10_000);
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** '2027-03' wordt 'maart 2027'. */
export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const index = Number(month) - 1;
  const names = [
    'januari',
    'februari',
    'maart',
    'april',
    'mei',
    'juni',
    'juli',
    'augustus',
    'september',
    'oktober',
    'november',
    'december',
  ];
  return `${names[index] ?? month ?? ''} ${year ?? ''}`.trim();
}

/**
 * Leest wat een ondernemer intikt: '35.000,50', '35000,5', '€ 35.000' of '35000.50'.
 * Staat er niets bruikbaars, dan null — het veld houdt dan zijn oude waarde.
 */
export function parseEuroInput(value: string): Cents | null {
  const amount = parseDutchNumber(value);
  return amount === null ? null : roundCents(amount * 100);
}

/** '7,5' wordt 750 basispunten. */
export function parsePercentInput(value: string): Bp | null {
  const amount = parseDutchNumber(value);
  return amount === null ? null : roundCents(amount * 100);
}

export function parseDutchNumber(value: string): number | null {
  const cleaned = value.replace(/[^\d,.-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const separator = Math.max(lastComma, lastDot);
  if (separator === -1) {
    const plain = Number(cleaned);
    return Number.isFinite(plain) ? plain : null;
  }

  // Eén punt met drie cijfers erachter en geen komma: dat is een duizendtalscheiding.
  const decimals = cleaned.length - separator - 1;
  const thousandsOnly = cleaned[separator] === '.' && lastComma === -1 && decimals === 3;
  const normalized = thousandsOnly
    ? cleaned.replace(/\./g, '')
    : `${cleaned.slice(0, separator).replace(/[.,]/g, '')}.${cleaned.slice(separator + 1)}`;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
