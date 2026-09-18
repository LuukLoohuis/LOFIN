import { Document, Line, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import { chartColors, METRIC_LABELS } from '../../charts/theme';
import { DISCLAIMER } from '../../config';
import { INSIGHT_TEXTS } from '../../config/texts';
import type { AccuracyResult, MetricKey, MonthMeta, PlanInput, PlanResult } from '../../engine';
import { formatCents, formatNumber, formatPercent } from '../../lib/format';
import { formatMetricValue, formatPercentChange } from '../../charts/format';
import { buildChartGeometry, type ChartSeriesPoint } from './chartGeometry';
import { Footer, KeyNumbers, Section, Table } from './components';
import { colors, styles } from './styles';

export interface ProgressReportProps {
  input: PlanInput;
  result: PlanResult;
  accuracy: AccuracyResult;
  months: readonly MonthMeta[];
  metric: MetricKey;
  planName: string;
  preparedOn: string;
}

/**
 * Kwartaalrapportage voor de financier: hoe het loopt ten opzichte van de ingediende
 * prognose, met de uitleg van de ondernemer erbij.
 */
export function ProgressReport({
  input,
  result,
  accuracy,
  months,
  metric,
  planName,
  preparedOn,
}: ProgressReportProps) {
  const closed = accuracy.months.filter((month) => month.actual !== null);
  const kpis = accuracy.kpis;
  const lastClosed = closed.at(-1);

  const points: ChartSeriesPoint[] = accuracy.months.map((month) => ({
    label: monthLabel(months[month.month]),
    forecast: month.forecast,
    actual: month.actual,
    reforecast: month.reforecast,
    band: month.band,
  }));

  return (
    <Document title={`Voortgangsrapportage ${planName}`} author={input.company.name} creator="LOFI">
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.coverLabel}>Voortgangsrapportage</Text>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', marginTop: 6 }}>{input.company.name}</Text>
          <Text style={styles.coverMeta}>
            {planName} · opgesteld op {preparedOn} · {closed.length} afgesloten{' '}
            {closed.length === 1 ? 'maand' : 'maanden'}
          </Text>
        </View>

        <Section title="In het kort">
          <KeyNumbers
            items={[
              {
                label: 'Prognosekwaliteit',
                value:
                  'insufficientData' in kpis ? '—' : formatPercent(Math.round(kpis.accuracy * 10_000), 0),
                note: 'insufficientData' in kpis ? 'te weinig maanden' : `over ${kpis.closedMonths} maanden`,
              },
              {
                label: 'Structurele afwijking',
                value: 'insufficientData' in kpis ? '—' : `${formatNumber(kpis.bias * 100, 1)}%`,
                note: 'prognose tegenover realisatie',
              },
              {
                label: 'Binnen de bandbreedte',
                value: 'insufficientData' in kpis ? '—' : formatPercent(Math.round(kpis.hitRate * 10_000), 0),
                note: `marge ${formatPercent(accuracy.toleranceBp, 0)}`,
              },
              {
                label: 'Laatste maand',
                value: lastClosed === undefined ? '—' : formatMetricValue(lastClosed.actual, metric),
                note:
                  lastClosed === undefined
                    ? undefined
                    : `${formatPercentChange(lastClosed.deviationPct)} tegenover prognose`,
              },
            ]}
          />
        </Section>

        <Section title={METRIC_LABELS[metric]} intro="Gestreept de ingediende prognose, doorgetrokken de realisatie.">
          <AccuracySvg points={points} lastClosedIndex={lastClosedIndex(accuracy)} />
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
            <Legend color={colors.muted} label="Prognose" dashed />
            <Legend color={chartColors.actual} label="Realisatie" />
            <Legend color={chartColors.reforecast} label="Bijgestelde prognose" dashed />
          </View>
        </Section>

        <Section title="Afwijking per maand" intro="Alleen afgesloten maanden.">
          <Table
            rowHeader="Maand"
            columns={['Prognose', 'Realisatie', 'Afwijking', 'Afwijking %']}
            rows={closed.map((month) => ({
              label: monthLabel(months[month.month]),
              values: [
                formatMetricValue(month.forecast, metric),
                formatMetricValue(month.actual, metric),
                formatMetricValue(month.deviation, metric),
                formatPercentChange(month.deviationPct),
              ],
            }))}
          />
        </Section>

        <Footer disclaimer={DISCLAIMER} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Wat de cijfers zeggen">
          {accuracy.insights.map((insight) => (
            <Text key={insight.ruleId} style={styles.paragraph}>
              • {INSIGHT_TEXTS[insight.ruleId]?.(insight.params) ?? insight.ruleId}
            </Text>
          ))}
        </Section>

        <Section title="Vooruitblik" intro="Op basis van de nieuwste prognose.">
          <Table
            rowHeader="Post"
            columns={['Waarde']}
            rows={[
              {
                label: 'Laagste kassaldo in de rest van de prognose',
                values: [formatCents(result.ratios.lowestCash.amount)],
              },
              {
                label: 'DSCR lopend boekjaar',
                values: [
                  result.ratios.dscr[0]?.value === null || result.ratios.dscr[0] === undefined
                    ? '—'
                    : formatNumber(result.ratios.dscr[0].value, 2),
                ],
              },
              {
                label: 'Afgesproken buffer',
                values: [formatCents(input.assumptions.minimumCashBufferCents)],
              },
              ...(accuracy.cashWarning === null
                ? []
                : [
                    {
                      label: 'Eerste maand onder de buffer',
                      values: [
                        `maand ${formatNumber(accuracy.cashWarning.month)} · ${formatCents(accuracy.cashWarning.balance)}`,
                      ],
                    },
                  ]),
            ]}
          />
        </Section>

        <Section title="Toelichting van de ondernemer">
          <Text style={styles.paragraph}>{input.explanations.risicos}</Text>
        </Section>

        <Footer disclaimer={DISCLAIMER} />
      </Page>
    </Document>
  );
}

function lastClosedIndex(accuracy: AccuracyResult): number | null {
  const index = accuracy.months.findIndex((month) => month.month === accuracy.lastClosedMonth);
  return index === -1 ? null : index;
}

function monthLabel(meta: MonthMeta | undefined): string {
  const abbreviations = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return meta === undefined ? '' : `${abbreviations[meta.month - 1] ?? ''} ${String(meta.year).slice(2)}`;
}

function AccuracySvg({ points, lastClosedIndex: marker }: { points: ChartSeriesPoint[]; lastClosedIndex: number | null }) {
  const layout = { width: 500, height: 200, padding: { top: 10, right: 10, bottom: 24, left: 56 } };
  const geometry = buildChartGeometry(points, layout, marker);

  return (
    <Svg width={layout.width} height={layout.height}>
      {geometry.ticks.map((tick) => (
        <Line
          key={`tick-${tick.value}`}
          x1={geometry.plot.x}
          y1={tick.y}
          x2={geometry.plot.x + geometry.plot.width}
          y2={tick.y}
          strokeWidth={0.5}
          stroke={colors.line}
        />
      ))}

      {geometry.bandPath !== null && <Path d={geometry.bandPath} fill={chartColors.band} fillOpacity={0.5} />}
      {geometry.forecastPath !== null && (
        <Path d={geometry.forecastPath} stroke={colors.muted} strokeWidth={1} strokeDasharray="4 3" fill="none" />
      )}
      {geometry.reforecastPath !== null && (
        <Path
          d={geometry.reforecastPath}
          stroke={chartColors.reforecast}
          strokeWidth={1}
          strokeDasharray="2 2"
          fill="none"
        />
      )}
      {geometry.actualPath !== null && (
        <Path d={geometry.actualPath} stroke={chartColors.actual} strokeWidth={1.6} fill="none" />
      )}
      {geometry.markerX !== null && (
        <Line
          x1={geometry.markerX}
          y1={geometry.plot.y}
          x2={geometry.markerX}
          y2={geometry.plot.y + geometry.plot.height}
          strokeWidth={0.8}
          stroke={colors.ink}
          strokeDasharray="2 2"
        />
      )}

      {geometry.labels.map((label) => (
        <Text key={`label-${label.label}`} x={label.x - 10} y={layout.height - 8} style={{ fontSize: 7, color: colors.muted }}>
          {label.label}
        </Text>
      ))}
      {geometry.ticks.map((tick) => (
        <Text key={`value-${tick.value}`} x={4} y={tick.y + 3} style={{ fontSize: 7, color: colors.muted }}>
          {formatCents(tick.value)}
        </Text>
      ))}
    </Svg>
  );
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Svg width={16} height={6}>
        <Line x1={0} y1={3} x2={16} y2={3} stroke={color} strokeWidth={1.5} {...(dashed ? { strokeDasharray: '3 2' } : {})} />
      </Svg>
      <Text style={{ fontSize: 7, color: colors.muted }}>{label}</Text>
    </View>
  );
}
