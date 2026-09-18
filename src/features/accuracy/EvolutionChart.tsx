import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatAxisValue, formatMetricValue } from '../../charts/format';
import { chartColors } from '../../charts/theme';
import type { EvolutionPoint, MetricKey } from '../../engine';

interface EvolutionChartProps {
  points: readonly EvolutionPoint[];
  actual: number | null;
  metric: MetricKey;
}

/** Hoe je verwachting voor één maand schoof, versie na versie, en waar hij uitkwam. */
export function EvolutionChart({ points, actual, metric }: EvolutionChartProps) {
  const data = points.map((point) => ({
    label: `v${point.versionNo}`,
    createdOn: point.createdOn,
    value: point.value,
    note: point.note,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: chartColors.grid }} />
        <YAxis
          tickFormatter={(value: number) => formatAxisValue(value, metric)}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip
          formatter={(value) => formatMetricValue(typeof value === 'number' ? value : null, metric)}
          labelFormatter={(label) => (typeof label === 'string' ? `Versie ${label.replace('v', '')}` : 'Versie')}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={chartColors.baseline}
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Verwachting"
          isAnimationActive={false}
          connectNulls
        />
        {actual !== null && (
          <ReferenceLine
            y={actual}
            stroke={chartColors.actual}
            strokeWidth={2}
            label={{ value: 'werkelijk', position: 'insideTopLeft', fontSize: 10, fill: chartColors.actual }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
