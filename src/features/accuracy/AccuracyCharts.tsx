import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAxisValue, formatMetricValue, formatPercentChange } from '../../charts/format';
import { chartColors, lineStyles, METRIC_LABELS } from '../../charts/theme';
import type { MetricKey } from '../../engine';
import { formatNumber } from '../../lib/format';
import type { AccuracyPoint } from './chartData';

const SYNC_ID = 'prognose-realisatie';

interface ChartProps {
  points: AccuracyPoint[];
  metric: MetricKey;
  lastClosedMonth: number | null;
}

/** Prognose, realisatie en bijgestelde prognose over elkaar heen, met de bandbreedte eromheen. */
export function AccuracyChart({ points, metric, lastClosedMonth }: ChartProps) {
  const markerLabel = points.find((point) => point.month === lastClosedMonth)?.label;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={points} syncId={SYNC_ID} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={chartColors.grid} strokeWidth={1} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: chartColors.grid }} interval="preserveStartEnd" />
        <YAxis
          tickFormatter={(value: number) => formatAxisValue(value, metric)}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip content={<AccuracyTooltip metric={metric} />} />

        <Area
          type="monotone"
          dataKey="band"
          stroke="none"
          fill={chartColors.band}
          fillOpacity={0.5}
          name="Bandbreedte"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          stroke={chartColors.baseline}
          strokeWidth={1.5}
          strokeDasharray={lineStyles.baseline}
          dot={false}
          name="Prognose"
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="reforecast"
          stroke={chartColors.reforecast}
          strokeWidth={1.5}
          strokeDasharray={lineStyles.reforecast}
          dot={false}
          name="Bijgesteld"
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke={chartColors.actual}
          strokeWidth={2.5}
          dot={{ r: 2 }}
          name="Realisatie"
          isAnimationActive={false}
        />
        {markerLabel !== undefined && (
          <ReferenceLine
            x={markerLabel}
            stroke={chartColors.marker}
            strokeWidth={1}
            strokeDasharray="3 3"
            label={{ value: 'laatste afgesloten maand', position: 'insideTopRight', fontSize: 10, fill: '#0f172a' }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Afwijking per maand: binnen de band neutraal, daarbuiten mee- of tegenvaller. */
export function DeviationChart({ points, metric }: Omit<ChartProps, 'lastClosedMonth'>) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={points} syncId={SYNC_ID} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={chartColors.grid} strokeWidth={1} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: chartColors.grid }} interval="preserveStartEnd" />
        <YAxis
          tickFormatter={(value: number) => `${formatNumber(value * 100, 0)}%`}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip content={<AccuracyTooltip metric={metric} />} />
        <ReferenceLine y={0} stroke={chartColors.marker} strokeWidth={1} />
        <Bar dataKey="within" fill={chartColors.within} name="Binnen de bandbreedte" isAnimationActive={false} stackId="afwijking" />
        <Bar dataKey="favourable" fill={chartColors.favourable} name="Meevaller" isAnimationActive={false} stackId="afwijking" />
        <Bar dataKey="unfavourable" fill={chartColors.unfavourable} name="Tegenvaller" isAnimationActive={false} stackId="afwijking" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: AccuracyPoint }[];
  metric: MetricKey;
}

function AccuracyTooltip({ active, payload, metric }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (active !== true || point === undefined) return null;

  return (
    <div className="max-w-xs rounded-md border border-slate-200 bg-white p-3 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{point.label}</p>
      <dl className="mt-1 space-y-0.5 text-slate-700">
        <Row label="Prognose" value={formatMetricValue(point.forecast, metric)} />
        <Row label="Realisatie" value={formatMetricValue(point.actual, metric)} />
        {point.reforecast !== null && <Row label="Bijgesteld" value={formatMetricValue(point.reforecast, metric)} />}
        {point.deviation !== null && (
          <Row
            label="Afwijking"
            value={`${formatMetricValue(point.deviation, metric)} (${formatPercentChange(point.deviationPct)})`}
          />
        )}
      </dl>
      {point.note !== null && <p className="mt-2 text-slate-500 italic">{point.note}</p>}
      <p className="mt-1 text-slate-400">{METRIC_LABELS[metric]}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
