import { describe, expect, it } from 'vitest';
import { sum } from '../core/money';
import { at } from '../core/series';
import { buildInvestments, existingAssetsSchedule, straightLine } from '../plan/depreciation';
import type { InvestmentItem } from '../types/input';

const asset = (overrides: Partial<InvestmentItem>): InvestmentItem => ({
  id: 'bus',
  description: 'Bedrijfsbus',
  category: 'bedrijfsmiddel',
  amountCents: 3_500_000,
  vatRateBp: 2100,
  lifeYears: 5,
  residualValueCents: 0,
  purchaseMonth: 0,
  ...overrides,
});

describe('straightLine', () => {
  it('schrijft af vanaf de maand na aanschaf', () => {
    const { depreciation, bookValue } = straightLine({
      costCents: 3_500_000,
      residualCents: 0,
      lifeMonths: 60,
      purchaseMonth: 0,
      length: 61,
    });
    expect(depreciation[0]).toBe(0);
    expect(sum(depreciation.slice(1, 13))).toBe(700_000);
    expect(bookValue[0]).toBe(3_500_000);
    expect(bookValue[12]).toBe(2_800_000);
    expect(bookValue[60]).toBe(0);
    expect(sum(depreciation)).toBe(3_500_000);
  });

  it('stopt bij de restwaarde', () => {
    const { depreciation, bookValue } = straightLine({
      costCents: 1_000_000,
      residualCents: 200_000,
      lifeMonths: 24,
      purchaseMonth: 0,
      length: 30,
    });
    expect(sum(depreciation)).toBe(800_000);
    expect(bookValue[24]).toBe(200_000);
    expect(bookValue[29]).toBe(200_000);
  });

  it('start later bij een latere aanschaf', () => {
    const { depreciation, bookValue } = straightLine({
      costCents: 1_200_000,
      residualCents: 0,
      lifeMonths: 12,
      purchaseMonth: 3,
      length: 20,
    });
    expect(depreciation.slice(0, 4).every((amount) => amount === 0)).toBe(true);
    expect(depreciation[4]).toBe(100_000);
    expect(bookValue[2]).toBe(0);
    expect(bookValue[3]).toBe(1_200_000);
    expect(bookValue[15]).toBe(0);
  });

  it('schrijft niets af zonder looptijd', () => {
    const { depreciation, bookValue } = straightLine({
      costCents: 500_000,
      residualCents: 0,
      lifeMonths: 0,
      purchaseMonth: 1,
      length: 6,
    });
    expect(sum(depreciation)).toBe(0);
    expect(bookValue[5]).toBe(500_000);
  });
});

describe('existingAssetsSchedule', () => {
  it('laat de bestaande afschrijving doorlopen tot de boekwaarde op is', () => {
    const schedule = existingAssetsSchedule(1_200_000, 240_000, 80);
    expect(schedule.investmentId).toBeNull();
    expect(sum(schedule.depreciation.slice(1, 13))).toBe(240_000);
    expect(schedule.bookValue[12]).toBe(960_000);
    expect(schedule.bookValue[60]).toBe(0);
    expect(sum(schedule.depreciation)).toBe(1_200_000);
  });

  it('blijft leeg voor een starter', () => {
    const schedule = existingAssetsSchedule(0, 0, 12);
    expect(sum(schedule.depreciation)).toBe(0);
  });
});

describe('buildInvestments', () => {
  it('splitst btw, voorraad en afschrijving', () => {
    const result = buildInvestments(
      [
        asset({}),
        asset({ id: 'gereedschap', amountCents: 1_000_000 }),
        asset({ id: 'voorraad', category: 'voorraad', amountCents: 800_000, lifeYears: null, purchaseMonth: 2 }),
        asset({ id: 'grond', category: 'overig', amountCents: 300_000, lifeYears: null, purchaseMonth: 1 }),
      ],
      61,
    );

    expect(result.exVat[0]).toBe(4_500_000);
    expect(result.vat[0]).toBe(945_000);
    expect(at(result.stock, 1)).toBe(0);
    expect(at(result.stock, 2)).toBe(800_000);
    expect(at(result.stock, 60)).toBe(800_000);
    expect(result.schedules.map((schedule) => schedule.investmentId)).toEqual(['bus', 'gereedschap', 'grond']);
    expect(sum(result.schedules.map((schedule) => at(schedule.depreciation, 12)))).toBe(75_000);
  });

  it('negeert investeringen buiten de horizon', () => {
    const result = buildInvestments([asset({ purchaseMonth: 99 })], 37);
    expect(sum(result.exVat)).toBe(0);
    expect(result.schedules).toHaveLength(0);
  });
});
