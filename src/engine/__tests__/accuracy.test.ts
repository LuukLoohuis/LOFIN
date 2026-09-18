import { describe, expect, it } from 'vitest';
import {
  bias,
  classifyDeviation,
  computeKpis,
  deviation,
  deviationPct,
  forecastAccuracy,
  hitRate,
  isFavourable,
  mad,
  trackingSignal,
  wape,
  withinTolerance,
  type Pair,
} from '../accuracy/metrics';
import { defaultEngineConfig } from '../../config';
import { calculatePlan } from '../plan/calculatePlan';
import { jansenPlan } from './fixtures/jansen';
import { buildAccuracy } from '../accuracy/buildAccuracy';
import {
  lastClosedMonth,
  METRIC_KEYS,
  metricSeriesFromActuals,
  metricSeriesFromResult,
  rollingDscr,
  valueAt,
} from '../accuracy/series';
import {
  baselineVersion,
  firstCashBreach,
  forecastEvolution,
  latestVersion,
  monthEndDate,
  versionForHorizon,
} from '../accuracy/versions';
import type { ActualMonth, ForecastSnapshot, MetricSeries } from '../types/accuracy';
import { EngineInputError } from '../core/errors';

/**
 * De testcasus uit de specificatie: zes afgesloten maanden omzet, bandbreedte 10%.
 * Verwacht: WAPE 7,91%, accuracy 92,09%, bias +3,60%, MAD 916,67, tracking signal −2,73,
 * hit rate 5 van 6 (−10,0% valt nog binnen de band).
 */
const FORECAST = [10_000, 12_000, 14_000, 14_000, 12_000, 10_000].map((euros) => euros * 100);
const ACTUAL = [9000, 12_500, 13_000, 15_000, 10_500, 9500].map((euros) => euros * 100);
const PAIRS: Pair[] = FORECAST.map((forecast, index) => ({
  month: index + 1,
  forecast,
  actual: ACTUAL[index] ?? 0,
}));
const TOLERANCE = 1000;

describe('afwijking per maand', () => {
  it('komt uit op de percentages uit de specificatie', () => {
    const percentages = PAIRS.map((pair) => Number(((deviationPct(pair) ?? 0) * 100).toFixed(1)));
    expect(percentages).toEqual([-10.0, 4.2, -7.1, 7.1, -12.5, -5.0]);
    expect(deviation(PAIRS[0] as Pair)).toBe(-100_000);
  });

  it('geeft geen percentage als er niets begroot was', () => {
    expect(deviationPct({ month: 1, forecast: 0, actual: 500 })).toBeNull();
  });

  it('rekent met de absolute prognose, zodat een minteken altijd hetzelfde betekent', () => {
    expect(deviationPct({ month: 1, forecast: -1000, actual: -1500 })).toBeCloseTo(-0.5, 10);
  });
});

describe('kengetallen', () => {
  it('komt uit op de getallen uit de specificatie', () => {
    expect((wape(PAIRS) ?? 0) * 100).toBeCloseTo(7.91, 2);
    expect((forecastAccuracy(PAIRS) ?? 0) * 100).toBeCloseTo(92.09, 2);
    expect((bias(PAIRS) ?? 0) * 100).toBeCloseTo(3.6, 2);
    expect(mad(PAIRS) / 100).toBeCloseTo(916.67, 2);
    expect(trackingSignal(PAIRS) ?? 0).toBeCloseTo(-2.73, 2);
    expect(hitRate(PAIRS, TOLERANCE)).toBeCloseTo(5 / 6, 10);
  });

  it('telt de grens van de bandbreedte nog mee', () => {
    const exactlyOnTheEdge: Pair = { month: 1, forecast: 1_000_000, actual: 900_000 };
    expect(withinTolerance(exactlyOnTheEdge, TOLERANCE)).toBe(true);
    expect(withinTolerance({ month: 1, forecast: 1_000_000, actual: 899_999 }, TOLERANCE)).toBe(false);
  });

  it('gaat netjes om met lege reeksen', () => {
    expect(wape([])).toBeNull();
    expect(forecastAccuracy([])).toBeNull();
    expect(bias([])).toBeNull();
    expect(mad([])).toBe(0);
    expect(trackingSignal([])).toBeNull();
    expect(hitRate([], TOLERANCE)).toBeNull();
    expect(hitRate([{ month: 1, forecast: 0, actual: 100 }], TOLERANCE)).toBeNull();
  });

  it('kan niet onder nul zakken', () => {
    const terrible: Pair[] = [{ month: 1, forecast: 1000, actual: 10 }];
    expect(forecastAccuracy(terrible)).toBe(0);
  });
});

describe('meevaller of tegenvaller', () => {
  it('draait het om bij kosten', () => {
    expect(isFavourable('omzet', 500)).toBe(true);
    expect(isFavourable('omzet', -500)).toBe(false);
    expect(isFavourable('vasteKosten', -500)).toBe(true);
    expect(isFavourable('vasteKosten', 500)).toBe(false);
  });

  it('kleurt een maand binnen, gunstig of ongunstig', () => {
    expect(classifyDeviation('omzet', { month: 1, forecast: 1000, actual: 1050 }, TOLERANCE)).toBe('binnen');
    expect(classifyDeviation('omzet', { month: 1, forecast: 1000, actual: 1500 }, TOLERANCE)).toBe('gunstig');
    expect(classifyDeviation('omzet', { month: 1, forecast: 1000, actual: 500 }, TOLERANCE)).toBe('ongunstig');
    expect(classifyDeviation('vasteKosten', { month: 1, forecast: 1000, actual: 1500 }, TOLERANCE)).toBe('ongunstig');
    expect(classifyDeviation('omzet', { month: 1, forecast: 0, actual: 500 }, TOLERANCE)).toBeNull();
  });
});

describe('computeKpis', () => {
  it('vraagt om minstens drie afgesloten maanden', () => {
    expect(computeKpis(PAIRS.slice(0, 2), 6, TOLERANCE)).toEqual({ insufficientData: true, closedMonths: 2 });
  });

  it('rekent over de laatste maanden van het venster', () => {
    const kpis = computeKpis(PAIRS, 6, TOLERANCE);
    if ('insufficientData' in kpis) throw new Error('verwachtte kengetallen');
    expect(kpis.closedMonths).toBe(6);
    expect(kpis.accuracy * 100).toBeCloseTo(92.09, 2);
    expect(kpis.hitRate).toBeCloseTo(5 / 6, 10);
    expect(kpis.trackingWarning).toBe(false);

    const laatsteDrie = computeKpis(PAIRS, 3, TOLERANCE);
    if ('insufficientData' in laatsteDrie) throw new Error('verwachtte kengetallen');
    expect(laatsteDrie.closedMonths).toBe(3);
  });

  it('waarschuwt als de prognose structureel één kant op loopt', () => {
    const drifting: Pair[] = Array.from({ length: 6 }, (_, index) => ({
      month: index + 1,
      forecast: 10_000,
      actual: 9000,
    }));
    const kpis = computeKpis(drifting, 6, TOLERANCE);
    if ('insufficientData' in kpis) throw new Error('verwachtte kengetallen');
    expect(kpis.trackingSignal).toBe(-6);
    expect(kpis.trackingWarning).toBe(true);
  });

  it('geeft nulwaarden terug als er niets te delen valt', () => {
    const empty: Pair[] = Array.from({ length: 3 }, (_, index) => ({ month: index + 1, forecast: 0, actual: 0 }));
    const kpis = computeKpis(empty, 3, TOLERANCE);
    if ('insufficientData' in kpis) throw new Error('verwachtte kengetallen');
    expect(kpis.accuracy).toBe(1);
    expect(kpis.bias).toBe(0);
    expect(kpis.trackingSignal).toBeNull();
    expect(kpis.hitRate).toBe(0);
  });
});

describe('realisatie omzetten in reeksen', () => {
  const actuals: ActualMonth[] = [
    {
      month: 1,
      status: 'afgesloten',
      source: 'handmatig',
      values: {
        omzet: 1_000_000,
        inkoopwaarde: 350_000,
        huur: 100_000,
        personeel: 50_000,
        priveOpnamen: 300_000,
        rente: 20_000,
        aflossing: 60_000,
        eindsaldo: 450_000,
      },
    },
    { month: 2, status: 'open', source: 'handmatig', values: { omzet: 1_100_000 } },
  ];

  it('telt alleen afgesloten maanden mee', () => {
    const series = metricSeriesFromActuals(actuals, 'eenmanszaak', 12);
    expect(series.omzet[1]).toBe(1_000_000);
    expect(series.omzet[2]).toBeNull();
    expect(series.brutomarge[1]).toBe(650_000);
    expect(series.vasteKosten[1]).toBe(150_000);
    expect(series.eindsaldo[1]).toBe(450_000);
    expect(lastClosedMonth(actuals)).toBe(1);
  });

  it('rekent de DSCR uit de ingevoerde cijfers', () => {
    const series = metricSeriesFromActuals(actuals, 'eenmanszaak', 12);
    // (1.000.000 − 350.000 − 150.000 − 300.000) / (20.000 + 60.000)
    expect(series.dscr12[1]).toBeCloseTo(200_000 / 80_000, 10);
  });

  it('laat privé-opnamen buiten beschouwing bij een bv', () => {
    const series = metricSeriesFromActuals(actuals, 'bv', 12);
    expect(series.dscr12[1]).toBeCloseTo(500_000 / 80_000, 10);
  });

  it('geeft niets terug zonder afgesloten maanden', () => {
    const series = metricSeriesFromActuals([], 'eenmanszaak', 6);
    expect(series.omzet.every((value) => value === null)).toBe(true);
    expect(lastClosedMonth([])).toBeNull();
  });

  it('kijkt veilig buiten de reeks', () => {
    expect(valueAt([1, null, 3], 0)).toBe(1);
    expect(valueAt([1, null, 3], 1)).toBeNull();
    expect(valueAt([1, null, 3], 99)).toBeNull();
  });
});

describe('reeksen uit een doorgerekend plan', () => {
  it('haalt de vijf grootheden uit het resultaat', () => {
    const result = calculatePlan(jansenPlan, defaultEngineConfig);
    const series = metricSeriesFromResult(result);

    expect(series.omzet[0]).toBeNull();
    expect(series.omzet[1]).toBe(1_250_000);
    expect(series.brutomarge[1]).toBe(812_500);
    expect(series.vasteKosten[1]).toBe(result.pnl.monthly[1]?.fixedCostsTotal);
    expect(series.eindsaldo[0]).toBe(55_000);
    expect(series.dscr12[12]).toBeCloseTo(2.685, 2);
    expect(METRIC_KEYS).toHaveLength(5);
  });
});

describe('voortschrijdende DSCR', () => {
  it('rekent met wat er is tot er twaalf maanden zijn', () => {
    const cfads = [0, ...Array.from({ length: 14 }, () => 1200)];
    const service = [0, ...Array.from({ length: 14 }, () => 1000)];
    const ratios = rollingDscr(cfads, service, 14);
    expect(ratios[0]).toBeNull();
    expect(ratios[1]).toBeCloseTo(1.2, 10);
    expect(ratios[14]).toBeCloseTo(1.2, 10);
  });

  it('geeft niets terug zonder schuldendienst of na de laatste afgesloten maand', () => {
    const ratios = rollingDscr([0, 100, 100], [0, 0, 0], 2);
    expect(ratios[1]).toBeNull();
    expect(rollingDscr([0, 100, 100], [0, 50, 50], 1)[2]).toBeNull();
  });
});

describe('versies', () => {
  const series = (values: number[]): MetricSeries => ({
    omzet: [null, ...values],
    brutomarge: [null, ...values],
    vasteKosten: [null, ...values],
    eindsaldo: [0, ...values],
    dscr12: [null, ...values.map(() => 1.5)],
  });

  const versions: ForecastSnapshot[] = [
    {
      id: 'v1',
      versionNo: 1,
      kind: 'baseline',
      createdOn: '2026-12-20',
      note: 'Ingediend bij de bank',
      engineVersion: '1.0.0',
      startMonth: '2027-01',
      series: series([1000, 1000, 1000, 1000, 1000, 1000]),
    },
    {
      id: 'v2',
      versionNo: 2,
      kind: 'reforecast',
      createdOn: '2027-04-10',
      note: 'Bijgesteld na een rustig voorjaar',
      engineVersion: '1.0.0',
      startMonth: '2027-01',
      series: series([900, 900, 900, 900, 900, 900]),
    },
  ];

  it('kent de basisversie en de nieuwste', () => {
    expect(baselineVersion(versions)?.id).toBe('v1');
    expect(latestVersion(versions)?.id).toBe('v2');
    expect(baselineVersion([])).toBeNull();
    expect(latestVersion([])).toBeNull();
    // Ook als de nieuwste toevallig vooraan staat.
    expect(latestVersion([...versions].reverse())?.id).toBe('v2');
  });

  it('geeft niets terug voor een maand buiten de reeks', () => {
    expect(forecastEvolution(versions, 'omzet', 99).map((point) => point.value)).toEqual([null, null]);
  });

  it('bepaalt het einde van een prognosemaand', () => {
    expect(monthEndDate('2027-01', 1)).toBe('2027-01-31');
    expect(monthEndDate('2027-01', 2)).toBe('2027-02-28');
    expect(monthEndDate('2028-01', 2)).toBe('2028-02-29');
    expect(monthEndDate('2027-01', 4)).toBe('2027-04-30');
    expect(() => monthEndDate('geen maand', 1)).toThrow(EngineInputError);
  });

  it('kiest per maand de versie die een maand eerder al bestond', () => {
    // Mei 2027: een maand eerder (30 april) bestond versie 2 al.
    expect(versionForHorizon(versions, '2027-01', 5, 1)?.id).toBe('v2');
    // Voor april 2027 was versie 2 er nog niet: die kwam op 10 april.
    expect(versionForHorizon(versions, '2027-01', 4, 1)?.id).toBe('v1');
    // Een kwartaal eerder is het nog steeds de basisversie.
    expect(versionForHorizon(versions, '2027-01', 5, 3)?.id).toBe('v1');
    expect(versionForHorizon(versions, '2027-01', 1, 3)).toBeNull();
  });

  it('laat zien hoe de verwachting voor één maand schoof', () => {
    const points = forecastEvolution(versions, 'omzet', 3);
    expect(points.map((point) => point.value)).toEqual([1000, 900]);
    expect(points[1]?.note).toBe('Bijgesteld na een rustig voorjaar');
  });

  it('vindt de eerste maand onder de buffer', () => {
    expect(firstCashBreach([0, 500, 400, 100], 200, 1)).toEqual({ month: 3, balance: 100 });
    expect(firstCashBreach([0, 500, 400, 100], 200, 4)).toBeNull();
    expect(firstCashBreach([0, null, 100], 200, 1)).toEqual({ month: 2, balance: 100 });
    expect(firstCashBreach([0, 500], 200, 1)).toBeNull();
  });
});

describe('buildAccuracy', () => {
  const baseSeries: MetricSeries = {
    omzet: [null, ...FORECAST, ...Array.from({ length: 6 }, () => 10_000_00)],
    brutomarge: [null, ...FORECAST],
    vasteKosten: [null, ...FORECAST],
    eindsaldo: [0, ...FORECAST.map(() => 500_000)],
    dscr12: [null, ...FORECAST.map(() => 1.4)],
  };

  const baseline: ForecastSnapshot = {
    id: 'v1',
    versionNo: 1,
    kind: 'baseline',
    createdOn: '2026-12-20',
    note: 'Ingediend',
    engineVersion: '1.0.0',
    startMonth: '2027-01',
    series: baseSeries,
  };

  const actuals: ActualMonth[] = ACTUAL.map((amount, index) => ({
    month: index + 1,
    status: 'afgesloten',
    source: 'handmatig',
    values: { omzet: amount, eindsaldo: 400_000 },
  }));

  const options = {
    metric: 'omzet' as const,
    comparison: 'baseline' as const,
    toleranceBp: TOLERANCE,
    window: 6 as const,
    legalForm: 'eenmanszaak' as const,
    horizonMonths: 12,
    startMonth: '2027-01',
    minimumCashBufferCents: 250_000,
  };

  it('zet prognose, realisatie en bandbreedte per maand op een rij', () => {
    const result = buildAccuracy([baseline], actuals, options);
    expect(result.months).toHaveLength(12);
    expect(result.lastClosedMonth).toBe(6);

    const january = result.months[0];
    expect(january?.forecast).toBe(1_000_000);
    expect(january?.actual).toBe(900_000);
    expect(january?.band).toEqual([900_000, 1_100_000]);
    expect(january?.status).toBe('binnen');
    expect(january?.closed).toBe(true);

    const may = result.months[4];
    expect(may?.status).toBe('ongunstig');
    expect(result.months[6]?.actual).toBeNull();
  });

  it('komt op de kengetallen uit de specificatie', () => {
    const result = buildAccuracy([baseline], actuals, options);
    if ('insufficientData' in result.kpis) throw new Error('verwachtte kengetallen');
    expect(result.kpis.accuracy * 100).toBeCloseTo(92.09, 2);
    expect(result.kpis.bias * 100).toBeCloseTo(3.6, 2);
    expect(result.kpis.hitRate).toBeCloseTo(5 / 6, 10);
  });

  it('meldt te weinig data zolang er minder dan drie maanden af zijn', () => {
    const result = buildAccuracy([baseline], actuals.slice(0, 2), options);
    expect(result.kpis).toEqual({ insufficientData: true, closedMonths: 2 });
    expect(result.insights[0]?.ruleId).toBe('te-weinig-data');
  });

  it('waarschuwt als het saldo onder de buffer zakt', () => {
    const lowCash: ForecastSnapshot = {
      ...baseline,
      series: { ...baseSeries, eindsaldo: [0, 500_000, 400_000, 100_000, ...Array.from({ length: 9 }, () => 100_000)] },
    };
    const result = buildAccuracy([lowCash], actuals.slice(0, 1), options);
    expect(result.cashWarning).toEqual({ month: 3, balance: 100_000, buffer: 250_000 });
    expect(result.insights.some((insight) => insight.ruleId === 'kas-onder-buffer')).toBe(true);
  });

  it('vertelt in gewone taal dat de prognose te hoog lag', () => {
    const result = buildAccuracy([baseline], actuals, options);
    const ids = result.insights.map((insight) => insight.ruleId);
    expect(ids).toContain('prognose-te-hoog');
    expect(ids).toContain('betrouwbare-prognose');
  });

  it('herkent een reeks tegenvallers', () => {
    const disappointing: ActualMonth[] = FORECAST.map((forecast, index) => ({
      month: index + 1,
      status: 'afgesloten',
      source: 'handmatig',
      values: { omzet: Math.round(forecast * 0.8) },
    }));
    const result = buildAccuracy([baseline], disappointing, options);
    expect(result.insights.some((insight) => insight.ruleId === 'reeks-tegenvallers')).toBe(true);
    expect(result.insights.some((insight) => insight.ruleId === 'loopt-uit-de-pas')).toBe(true);
  });

  it('herkent ook een reeks meevallers', () => {
    const better: ActualMonth[] = FORECAST.map((forecast, index) => ({
      month: index + 1,
      status: 'afgesloten',
      source: 'handmatig',
      values: { omzet: Math.round(forecast * 1.2) },
    }));
    const result = buildAccuracy([baseline], better, options);
    expect(result.insights.some((insight) => insight.ruleId === 'reeks-meevallers')).toBe(true);
    expect(result.insights.some((insight) => insight.ruleId === 'prognose-te-laag')).toBe(true);
  });

  it('kan ook vergelijken met de prognose van een maand eerder', () => {
    const reforecast: ForecastSnapshot = {
      ...baseline,
      id: 'v2',
      versionNo: 2,
      kind: 'reforecast',
      createdOn: '2027-03-31',
      note: 'Bijgesteld',
      series: { ...baseSeries, omzet: [null, ...FORECAST.map((value) => value * 0.9)] },
    };
    const result = buildAccuracy([baseline, reforecast], actuals, { ...options, comparison: 'horizon1' });
    expect(result.months[0]?.forecast).toBe(1_000_000);
    expect(result.months[4]?.forecast).toBe(1_080_000);
    expect(result.months[4]?.note).toBe('Bijgesteld');
  });

  it('gaat om met een lege geschiedenis', () => {
    const result = buildAccuracy([], [], { ...options, comparison: 'horizon3' });
    expect(result.months.every((month) => month.forecast === null && month.actual === null)).toBe(true);
    expect(result.cashWarning).toBeNull();
  });

  it('kijkt vanaf maand 1 vooruit zolang er nog niets is afgesloten', () => {
    const lowCash: ForecastSnapshot = {
      ...baseline,
      series: { ...baseSeries, eindsaldo: [0, 100_000, ...Array.from({ length: 11 }, () => 100_000)] },
    };
    const result = buildAccuracy([lowCash], [], options);
    expect(result.lastClosedMonth).toBeNull();
    expect(result.cashWarning?.month).toBe(1);
  });

  it('zegt niets over een patroon als alles precies uitkomt', () => {
    const exact: ActualMonth[] = FORECAST.map((forecast, index) => ({
      month: index + 1,
      status: 'afgesloten',
      source: 'handmatig',
      values: { omzet: forecast },
    }));
    const result = buildAccuracy([baseline], exact, options);
    if ('insufficientData' in result.kpis) throw new Error('verwachtte kengetallen');
    expect(result.kpis.accuracy).toBe(1);
    expect(result.kpis.trackingSignal).toBeNull();
    expect(result.months.every((month) => month.status === null || month.status === 'binnen')).toBe(true);
    expect(result.insights.map((insight) => insight.ruleId)).toEqual(['betrouwbare-prognose']);
  });

  it('breekt een reeks af zodra een maand de andere kant op wijkt', () => {
    const mixed: ActualMonth[] = FORECAST.map((forecast, index) => ({
      month: index + 1,
      status: 'afgesloten',
      source: 'handmatig',
      // Eerst drie meevallers, daarna drie tegenvallers.
      values: { omzet: Math.round(forecast * (index < 3 ? 1.3 : 0.7)) },
    }));
    const result = buildAccuracy([baseline], mixed, options);
    const streak = result.insights.find((insight) => insight.ruleId === 'reeks-tegenvallers');
    expect(streak?.params['months']).toBe(3);
  });
});
