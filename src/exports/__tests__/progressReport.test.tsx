import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { defaultEngineConfig } from '../../config';
import { buildAccuracy, calculatePlan } from '../../engine';
import { createDemoCase } from '../../demo/loodgieter';
import { buildChartGeometry } from '../pdf/chartGeometry';
import { ProgressReport } from '../pdf/ProgressReport';

const demo = createDemoCase();
const result = calculatePlan(demo.plan.input, defaultEngineConfig);
const accuracy = buildAccuracy(demo.versions, demo.actuals, {
  metric: 'omzet',
  comparison: 'baseline',
  toleranceBp: 1000,
  window: 6,
  legalForm: demo.plan.input.company.legalForm,
  horizonMonths: result.meta.horizonMonths,
  startMonth: demo.plan.input.assumptions.startMonth,
  minimumCashBufferCents: demo.plan.input.assumptions.minimumCashBufferCents,
});

describe('voorbeeldcasus', () => {
  it('heeft veertien afgesloten maanden en twee versies', () => {
    expect(demo.actuals).toHaveLength(14);
    expect(demo.actuals.every((month) => month.status === 'afgesloten')).toBe(true);
    expect(demo.versions.map((version) => version.kind)).toEqual(['baseline', 'reforecast']);
    expect(accuracy.lastClosedMonth).toBe(14);
  });

  it('laat de zomerdip zien als tegenvaller', () => {
    const july = accuracy.months.find((month) => month.month === 7);
    const august = accuracy.months.find((month) => month.month === 8);
    expect(july?.status).toBe('ongunstig');
    expect(august?.status).toBe('ongunstig');
    expect(august?.deviationPct ?? 0).toBeLessThan(-0.2);
  });
});

describe('meetkunde van de grafiek', () => {
  it('maakt paden binnen het tekenvlak', () => {
    const points = accuracy.months.map((month) => ({
      label: `m${month.month}`,
      forecast: month.forecast,
      actual: month.actual,
      reforecast: month.reforecast,
      band: month.band,
    }));
    const geometry = buildChartGeometry(points, { width: 400, height: 200, padding: { top: 10, right: 10, bottom: 20, left: 40 } }, 13);

    expect(geometry.actualPath?.startsWith('M ')).toBe(true);
    expect(geometry.bandPath?.endsWith('Z')).toBe(true);
    expect(geometry.ticks).toHaveLength(5);
    expect(geometry.labels.length).toBeLessThanOrEqual(8);
    expect(geometry.markerX).not.toBeNull();
  });

  it('gaat om met een lege reeks', () => {
    const geometry = buildChartGeometry([], { width: 300, height: 150, padding: { top: 5, right: 5, bottom: 5, left: 5 } }, null);
    expect(geometry.actualPath).toBeNull();
    expect(geometry.bandPath).toBeNull();
    expect(geometry.markerX).toBeNull();
  });
});

describe('voortgangsrapportage', () => {
  it('rendert een pdf met de grafiek erin', async () => {
    const buffer = await renderToBuffer(
      <ProgressReport
        input={demo.plan.input}
        result={result}
        accuracy={accuracy}
        months={result.meta.months}
        metric="omzet"
        planName={demo.plan.name}
        preparedOn="5 maart 2028"
      />,
    );

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(5000);
    expect(buffer.toString('latin1').split('/Type /Page').length - 1).toBeGreaterThanOrEqual(2);
  }, 30_000);
});
