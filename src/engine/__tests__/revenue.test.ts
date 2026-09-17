import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../core/calendar';
import { sum } from '../core/money';
import { at } from '../core/series';
import { baseMonthlyRevenue, buildRevenue, validateSeasonality } from '../plan/revenue';
import type { AssumptionsInput } from '../types/input';
import { emptyPlan } from './fixtures/builders';

const RAMP_UP_MONTHS = 12;
const january = buildTimeline({ year: 2027, month: 1 });

function assumptions(adjust: (draft: AssumptionsInput) => void): AssumptionsInput {
  const draft = emptyPlan().assumptions;
  adjust(draft);
  return draft;
}

describe('baseMonthlyRevenue', () => {
  it('rekent alle drie de omzetmodellen door', () => {
    expect(baseMonthlyRevenue({ kind: 'uurtarief', hourlyRateCents: 6500, billableHoursPerMonth: 100 })).toBe(650_000);
    expect(baseMonthlyRevenue({ kind: 'opdrachten', jobsPerMonth: 8, averageJobValueCents: 125_000 })).toBe(1_000_000);
    expect(baseMonthlyRevenue({ kind: 'maandbedrag', monthlyAmountCents: 1_250_000, monthlyGrowthBp: 0 })).toBe(1_250_000);
  });
});

describe('buildRevenue', () => {
  it('houdt een vast maandbedrag vlak en laat het startmoment leeg', () => {
    const revenue = buildRevenue(
      assumptions((draft) => {
        draft.revenue = { kind: 'maandbedrag', monthlyAmountCents: 1_250_000, monthlyGrowthBp: 0 };
      }),
      january,
      RAMP_UP_MONTHS,
      0,
    );
    expect(revenue[0]).toBe(0);
    expect(revenue[1]).toBe(1_250_000);
    expect(sum(revenue.slice(1, 13))).toBe(15_000_000);
  });

  it('laat de omzet in de aanloop per maand groeien en daarna per boekjaar', () => {
    const revenue = buildRevenue(
      assumptions((draft) => {
        draft.revenue = { kind: 'maandbedrag', monthlyAmountCents: 1_000_000, monthlyGrowthBp: 200 };
        draft.revenueGrowthBp = { y2: 500, y3: 1000 };
      }),
      january,
      RAMP_UP_MONTHS,
      0,
    );
    expect(revenue[1]).toBe(1_000_000);
    expect(revenue[6]).toBe(1_104_081);
    expect(revenue[12]).toBe(1_243_374);
    expect(sum(revenue.slice(1, 13))).toBe(13_412_089);
    // Jaar 2 rekent verder vanaf het decemberniveau, niet vanaf het jaartotaal.
    expect(revenue[13]).toBe(1_305_543);
    expect(revenue[25]).toBe(1_436_097);
  });

  it('kent geen aanloopgroei bij uurtarief of opdrachten', () => {
    const hourly = buildRevenue(
      assumptions((draft) => {
        draft.revenue = { kind: 'uurtarief', hourlyRateCents: 6500, billableHoursPerMonth: 100 };
        draft.revenueGrowthBp = { y2: 1000, y3: 0 };
      }),
      january,
      RAMP_UP_MONTHS,
      0,
    );
    expect(hourly[1]).toBe(650_000);
    expect(hourly[12]).toBe(650_000);
    expect(hourly[13]).toBe(715_000);

    const jobs = buildRevenue(
      assumptions((draft) => {
        draft.revenue = { kind: 'opdrachten', jobsPerMonth: 8, averageJobValueCents: 125_000 };
      }),
      january,
      RAMP_UP_MONTHS,
      0,
    );
    expect(jobs[1]).toBe(1_000_000);
    expect(jobs[12]).toBe(1_000_000);
  });

  it('volgt het seizoenspatroon per kalendermaand', () => {
    const seasonality = [120, 120, 100, 100, 100, 100, 80, 80, 100, 100, 100, 100];
    const october = buildTimeline({ year: 2026, month: 10 });
    const revenue = buildRevenue(
      assumptions((draft) => {
        draft.revenue = { kind: 'maandbedrag', monthlyAmountCents: 1_000_000, monthlyGrowthBp: 0 };
        draft.seasonality = seasonality;
      }),
      october,
      RAMP_UP_MONTHS,
      0,
    );
    expect(revenue[1]).toBe(1_000_000); // oktober
    expect(revenue[4]).toBe(1_200_000); // januari
    expect(revenue[10]).toBe(800_000); // juli
  });

  it('schaalt mee met een scenario', () => {
    const base = assumptions((draft) => {
      draft.revenue = { kind: 'maandbedrag', monthlyAmountCents: 1_000_000, monthlyGrowthBp: 0 };
    });
    expect(at(buildRevenue(base, january, RAMP_UP_MONTHS, -2000), 1)).toBe(800_000);
    expect(at(buildRevenue(base, january, RAMP_UP_MONTHS, 1000), 1)).toBe(1_100_000);
  });

  it('rekent met nul omzet als een gewicht ontbreekt', () => {
    const revenue = buildRevenue(
      assumptions((draft) => {
        draft.revenue = { kind: 'maandbedrag', monthlyAmountCents: 1_000_000, monthlyGrowthBp: 0 };
        draft.seasonality = [100, 100];
      }),
      january,
      RAMP_UP_MONTHS,
      0,
    );
    expect(revenue[1]).toBe(1_000_000);
    expect(revenue[3]).toBe(0);
  });
});

describe('validateSeasonality', () => {
  it('keurt twaalf gewichten van samen 1200 goed', () => {
    expect(validateSeasonality(Array.from({ length: 12 }, () => 100))).toBeNull();
  });

  it('meldt een verkeerde som', () => {
    const weights = Array.from({ length: 12 }, () => 100);
    weights[0] = 110;
    expect(validateSeasonality(weights)).toMatchObject({
      code: 'SEASONALITY_INVALID',
      severity: 'error',
      params: { count: 12, sum: 1210 },
    });
  });

  it('meldt een verkeerd aantal maanden', () => {
    expect(validateSeasonality([100, 100])?.params).toEqual({ count: 2, sum: 200 });
  });

  it('weigert kommagetallen en negatieve gewichten', () => {
    const halves = Array.from({ length: 12 }, () => 100);
    halves[0] = 99.5;
    halves[1] = 100.5;
    expect(validateSeasonality(halves)?.code).toBe('SEASONALITY_INVALID');

    const negative = Array.from({ length: 12 }, () => 100);
    negative[0] = -100;
    negative[1] = 300;
    expect(validateSeasonality(negative)?.code).toBe('SEASONALITY_INVALID');
  });
});
