import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../core/calendar';
import { sum } from '../core/money';
import { at } from '../core/series';
import {
  buildDividends,
  buildFixedCosts,
  buildOneOffCosts,
  buildPrivateWithdrawals,
  buildStaffCosts,
} from '../plan/costs';
import type { FixedCostLine } from '../types/input';

const january = buildTimeline({ year: 2027, month: 1 });
const october = buildTimeline({ year: 2026, month: 10 });
const noGrowth = { y2: 0, y3: 0 };

const line = (overrides: Partial<FixedCostLine>): FixedCostLine => ({
  id: 'huur',
  category: 'huur',
  description: 'Bedrijfsruimte',
  amountCents: 100_000,
  per: 'maand',
  vatRateBp: 2100,
  ...overrides,
});

describe('buildFixedCosts', () => {
  it('verdeelt een jaarbedrag exact over een boekjaar', () => {
    const result = buildFixedCosts([line({ amountCents: 2_000_000, per: 'jaar' })], january, noGrowth);
    expect(sum(result.total.slice(1, 13))).toBe(2_000_000);
    expect(result.total[0]).toBe(0);
    expect(sum(result.total)).toBe(6_000_000);
  });

  it('geeft de startperiode alleen haar eigen maanden', () => {
    const result = buildFixedCosts([line({ amountCents: 1_200_000, per: 'jaar' })], october, noGrowth);
    expect(sum(result.total.slice(1, 4))).toBe(300_000);
    expect(sum(result.total.slice(4, 16))).toBe(1_200_000);
  });

  it('indexeert maandbedragen per boekjaar en rekent btw per regel', () => {
    const result = buildFixedCosts([line({})], january, { y2: 500, y3: 0 });
    expect(result.byCategory.huur[1]).toBe(100_000);
    expect(result.byCategory.huur[13]).toBe(105_000);
    expect(result.byCategory.huur[25]).toBe(105_000);
    expect(result.vat[1]).toBe(21_000);
  });

  it('houdt categorieën uit elkaar', () => {
    const result = buildFixedCosts(
      [line({}), line({ id: 'verzekering', category: 'verzekeringen', amountCents: 25_000, vatRateBp: 0 })],
      january,
      noGrowth,
    );
    expect(result.byCategory.verzekeringen[1]).toBe(25_000);
    expect(result.total[1]).toBe(125_000);
    expect(result.vat[1]).toBe(21_000);
  });
});

describe('buildStaffCosts', () => {
  it('rekent werkgeverslasten mee binnen de dienstperiode', () => {
    const costs = buildStaffCosts(
      [
        {
          id: 'monteur',
          description: 'Monteur',
          grossMonthlyCents: 300_000,
          employerCostBp: 3000,
          startMonth: 4,
          endMonth: 10,
        },
      ],
      january,
      noGrowth,
    );
    expect(costs[3]).toBe(0);
    expect(costs[4]).toBe(390_000);
    expect(costs[10]).toBe(390_000);
    expect(costs[11]).toBe(0);
  });

  it('begint op zijn vroegst in maand 1 en loopt zonder einddatum door', () => {
    const costs = buildStaffCosts(
      [
        {
          id: 'monteur',
          description: 'Monteur',
          grossMonthlyCents: 200_000,
          employerCostBp: 0,
          startMonth: 0,
          endMonth: null,
        },
      ],
      january,
      { y2: 1000, y3: 0 },
    );
    expect(costs[0]).toBe(0);
    expect(costs[1]).toBe(200_000);
    expect(costs[13]).toBe(220_000);
  });
});

describe('buildOneOffCosts', () => {
  it('boekt eenmalige kosten in hun eigen maand', () => {
    const result = buildOneOffCosts(
      [
        { id: 'notaris', description: 'Notaris', amountCents: 150_000, vatRateBp: 2100, month: 0 },
        { id: 'inschrijving', description: 'KvK', amountCents: 8000, vatRateBp: 0, month: 0 },
        { id: 'later', description: 'Buiten de horizon', amountCents: 100_000, vatRateBp: 2100, month: 99 },
      ],
      37,
    );
    expect(result.amount[0]).toBe(158_000);
    expect(result.vat[0]).toBe(31_500);
    expect(sum(result.amount)).toBe(158_000);
  });
});

describe('buildPrivateWithdrawals', () => {
  it('loopt vanaf de eerste prognosemaand bij een eenmanszaak', () => {
    const withdrawals = buildPrivateWithdrawals(380_000, 'eenmanszaak', 13);
    expect(withdrawals[0]).toBe(0);
    expect(sum(withdrawals)).toBe(4_560_000);
  });

  it('blijft leeg bij een bv', () => {
    expect(sum(buildPrivateWithdrawals(380_000, 'bv', 13))).toBe(0);
  });
});

describe('buildDividends', () => {
  it('keert bij een bv uit in de laatste maand van elk boekjaar', () => {
    const dividends = buildDividends({ y1: 1_000_000, y2: 2_000_000, y3: 0 }, 'bv', october);
    expect(at(dividends, 3)).toBe(0);
    expect(at(dividends, 15)).toBe(1_000_000);
    expect(at(dividends, 27)).toBe(2_000_000);
    expect(sum(dividends)).toBe(3_000_000);
  });

  it('is leeg bij een eenmanszaak', () => {
    expect(sum(buildDividends({ y1: 1_000_000, y2: 0, y3: 0 }, 'eenmanszaak', january))).toBe(0);
  });
});
