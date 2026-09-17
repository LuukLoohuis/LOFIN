import { describe, expect, it } from 'vitest';
import {
  formatCents,
  formatCentsInput,
  formatPercent,
  formatYearMonth,
  parseDutchNumber,
  parseEuroInput,
  parsePercentInput,
} from '../format';

/** Intl gebruikt harde spaties; die halen we eruit zodat de test leesbaar blijft. */
const compact = (value: string) => value.replace(/\s/g, '');

describe('formatCents', () => {
  it('schrijft bedragen op zijn Nederlands', () => {
    expect(compact(formatCents(3_500_000))).toBe('€35.000,00');
    expect(compact(formatCents(-1234))).toBe('€-12,34');
    expect(formatCentsInput(3_500_000)).toBe('35.000,00');
  });
});

describe('formatPercent', () => {
  it('rekent basispunten terug naar procenten', () => {
    expect(compact(formatPercent(700))).toBe('7,00%');
    expect(compact(formatPercent(2100, 0))).toBe('21%');
  });
});

describe('formatYearMonth', () => {
  it('maakt van 2027-03 maart 2027', () => {
    expect(formatYearMonth('2027-03')).toBe('maart 2027');
    expect(formatYearMonth('2026-12')).toBe('december 2026');
  });
});

describe('parseEuroInput', () => {
  it('leest wat een ondernemer intikt', () => {
    expect(parseEuroInput('35000')).toBe(3_500_000);
    expect(parseEuroInput('35.000,50')).toBe(3_500_050);
    expect(parseEuroInput('35000,5')).toBe(3_500_050);
    expect(parseEuroInput('€ 1.250')).toBe(125_000);
    expect(parseEuroInput('1234.56')).toBe(123_456);
    expect(parseEuroInput('-250,25')).toBe(-25_025);
  });

  it('geeft niets terug bij onzin', () => {
    expect(parseEuroInput('')).toBeNull();
    expect(parseEuroInput('abc')).toBeNull();
    expect(parseEuroInput('-')).toBeNull();
  });
});

describe('parsePercentInput', () => {
  it('maakt van procenten basispunten', () => {
    expect(parsePercentInput('7')).toBe(700);
    expect(parsePercentInput('7,5')).toBe(750);
    expect(parsePercentInput('21%')).toBe(2100);
  });
});

describe('parseDutchNumber', () => {
  it('herkent een duizendtalpunt alleen bij drie cijfers erachter', () => {
    expect(parseDutchNumber('1.000')).toBe(1000);
    expect(parseDutchNumber('1.5')).toBe(1.5);
    expect(parseDutchNumber('1.000,25')).toBe(1000.25);
    expect(parseDutchNumber('12')).toBe(12);
  });
});
