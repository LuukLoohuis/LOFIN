import { Callout } from '../../components/ui/Callout';
import { TRACKING_SIGNAL_LIMIT, type AccuracyResult, type MetricKey } from '../../engine';
import { formatCents, formatNumber, formatPercent } from '../../lib/format';
import { METRIC_LABELS } from '../../charts/theme';

interface KpiTilesProps {
  accuracy: AccuracyResult;
  metric: MetricKey;
}

export function KpiTiles({ accuracy, metric }: KpiTilesProps) {
  const { kpis } = accuracy;

  if ('insufficientData' in kpis) {
    return (
      <Callout tone="info" title="Nog te weinig data">
        Je hebt {kpis.closedMonths} {kpis.closedMonths === 1 ? 'maand' : 'maanden'} afgesloten. Vanaf drie maanden
        kunnen we zeggen hoe goed je prognose was.
      </Callout>
    );
  }

  const biasDirection = describeBias(kpis.bias, metric);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        label="Prognosekwaliteit"
        value={formatPercent(Math.round(kpis.accuracy * 10_000), 0)}
        note={`over ${kpis.closedMonths} maanden`}
        explanation="1 − WAPE: hoe dicht je prognose bij de werkelijkheid lag."
      />
      <Tile
        label="Structurele afwijking"
        value={`${kpis.bias > 0 ? '+' : ''}${formatNumber(kpis.bias * 100, 1)}%`}
        note={biasDirection}
        explanation="Positief betekent dat je prognose gemiddeld hoger lag dan de werkelijkheid."
      />
      <Tile
        label="Binnen de bandbreedte"
        value={formatPercent(Math.round(kpis.hitRate * 10_000), 0)}
        note={`${Math.round(kpis.hitRate * kpis.closedMonths)} van ${kpis.closedMonths} maanden`}
        explanation="Hoe vaak je prognose binnen de afgesproken marge bleef."
      />
      <Tile
        label="Tracking signal"
        value={kpis.trackingSignal === null ? '—' : formatNumber(kpis.trackingSignal, 1)}
        note={kpis.trackingWarning ? `buiten ±${TRACKING_SIGNAL_LIMIT}` : 'stabiel'}
        tone={kpis.trackingWarning ? 'warning' : 'default'}
        explanation="Loopt je prognose steeds dezelfde kant op? Buiten ±4 is dat geen toeval meer."
      />
      {accuracy.cashWarning !== null && (
        <div className="sm:col-span-2 lg:col-span-4">
          <Callout tone="warning" title="Je saldo zakt onder je buffer">
            In maand {accuracy.cashWarning.month} staat er volgens je nieuwste prognose{' '}
            {formatCents(accuracy.cashWarning.balance)} op de rekening, tegen een buffer van{' '}
            {formatCents(accuracy.cashWarning.buffer)}.
          </Callout>
        </div>
      )}
    </div>
  );
}

function describeBias(bias: number, metric: MetricKey): string {
  if (Math.abs(bias) < 0.005) return 'geen patroon';
  const optimistic = metric === 'vasteKosten' ? bias < 0 : bias > 0;
  return optimistic
    ? `je begrootte ${METRIC_LABELS[metric].toLowerCase()} te gunstig`
    : `je begrootte ${METRIC_LABELS[metric].toLowerCase()} te voorzichtig`;
}

function Tile({
  label,
  value,
  note,
  explanation,
  tone = 'default',
}: {
  label: string;
  value: string;
  note: string;
  explanation: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'warning' ? 'text-amber-700' : 'text-slate-900'}`}>
        {value}
      </p>
      <p className="text-xs text-slate-500">{note}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{explanation}</p>
    </div>
  );
}
