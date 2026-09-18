import { BP_PER_UNIT } from '../core/money';
import type { Bp } from '../types/input';
import type { AccuracyInsight, AccuracyKpis, AccuracyMonth, AccuracyResult, MetricKey } from '../types/accuracy';
import { isFavourable, TRACKING_SIGNAL_LIMIT } from './metrics';

/**
 * Signalen in gewone taal, met vaste regels. Ze beschrijven wat er in de cijfers zit en
 * zeggen nooit wat iemand moet doen: dat zou advies zijn.
 */
export function buildInsights(params: {
  metric: MetricKey;
  kpis: AccuracyKpis | { insufficientData: true; closedMonths: number };
  months: readonly AccuracyMonth[];
  cashWarning: AccuracyResult['cashWarning'];
  toleranceBp: Bp;
}): AccuracyInsight[] {
  const { metric, kpis, months, cashWarning } = params;
  const insights: AccuracyInsight[] = [];

  // Een naderend kastekort telt altijd, ook als er nog weinig maanden af zijn.
  const cashInsight: AccuracyInsight[] =
    cashWarning === null
      ? []
      : [
          {
            ruleId: 'kas-onder-buffer',
            severity: 'warning',
            params: { month: cashWarning.month, balance: cashWarning.balance, buffer: cashWarning.buffer },
          },
        ];

  if ('insufficientData' in kpis) {
    insights.push({ ruleId: 'te-weinig-data', severity: 'info', params: { closedMonths: kpis.closedMonths } });
    return [...insights, ...cashInsight];
  }

  // Structureel te hoog of te laag begroot: een kwart van de bandbreedte is al een patroon.
  if (Math.abs(kpis.bias) * BP_PER_UNIT >= params.toleranceBp / 4) {
    insights.push({
      ruleId: kpis.bias > 0 ? 'prognose-te-hoog' : 'prognose-te-laag',
      severity: 'info',
      params: { metric, months: kpis.closedMonths, biasPct: Math.abs(kpis.bias) * 100 },
    });
  }

  const signal = kpis.trackingSignal;
  if (signal !== null && Math.abs(signal) > TRACKING_SIGNAL_LIMIT) {
    insights.push({
      ruleId: 'loopt-uit-de-pas',
      severity: 'warning',
      params: { metric, trackingSignal: signal, limit: TRACKING_SIGNAL_LIMIT },
    });
  }

  if (kpis.hitRate >= 0.8) {
    insights.push({
      ruleId: 'betrouwbare-prognose',
      severity: 'info',
      params: { hitRatePct: kpis.hitRate * 100, accuracyPct: kpis.accuracy * 100 },
    });
  }

  // Een reeks van drie maanden dezelfde kant op valt een financier op.
  const streak = trailingStreak(months, metric);
  if (streak.length >= 3) {
    insights.push({
      ruleId: streak.favourable ? 'reeks-meevallers' : 'reeks-tegenvallers',
      severity: streak.favourable ? 'info' : 'warning',
      params: { metric, months: streak.length },
    });
  }

  return [...insights, ...cashInsight];
}

/** Hoeveel afgesloten maanden op rij wijken dezelfde kant op af, buiten de bandbreedte? */
function trailingStreak(
  months: readonly AccuracyMonth[],
  metric: MetricKey,
): { length: number; favourable: boolean } {
  const outside = months.flatMap((month) =>
    month.deviation !== null && month.status !== null && month.status !== 'binnen'
      ? [month.deviation]
      : [],
  );
  const last = outside.at(-1);
  if (last === undefined) return { length: 0, favourable: true };

  const favourable = isFavourable(metric, last);
  let length = 0;
  for (const value of [...outside].reverse()) {
    if (isFavourable(metric, value) !== favourable) break;
    length += 1;
  }
  return { length, favourable };
}
