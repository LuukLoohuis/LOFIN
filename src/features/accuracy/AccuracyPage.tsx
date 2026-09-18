import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { ChartFrame } from '../../charts/ChartFrame';
import { Button } from '../../components/ui/Button';
import { formatMetricValue } from '../../charts/format';
import { METRIC_LABELS } from '../../charts/theme';
import { Callout } from '../../components/ui/Callout';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { INSIGHT_TEXTS } from '../../config/texts';
import { usePlanStore } from '../../data/planStore';
import {
  buildAccuracy,
  forecastEvolution,
  latestVersion,
  METRIC_KEYS,
  metricSeriesFromActuals,
  type ComparisonBasis,
  type MetricKey,
} from '../../engine';
import { formatYearMonth } from '../../lib/format';
import { useWizard } from '../wizard/context';
import { usePlanResult } from '../wizard/usePlanResult';
import { AccuracyChart, DeviationChart } from './AccuracyCharts';
import { ActualsForm } from './ActualsForm';
import { accuracyTable, describeAccuracy, monthLabel, toChartData } from './chartData';
import { CsvImport } from './CsvImport';
import { EvolutionChart } from './EvolutionChart';
import { KpiTiles } from './KpiTiles';
import { LockVersionCard } from './LockVersionCard';

const COMPARISONS: { value: ComparisonBasis; label: string }[] = [
  { value: 'baseline', label: 'Met de ingediende prognose' },
  { value: 'horizon1', label: 'Met de prognose van een maand eerder' },
  { value: 'horizon3', label: 'Met de prognose van een kwartaal eerder' },
];

const TOLERANCES = [
  { value: '500', label: '5%' },
  { value: '1000', label: '10%' },
  { value: '1500', label: '15%' },
  { value: '2000', label: '20%' },
];

export function AccuracyPage() {
  const { input } = useWizard();
  const result = usePlanResult(input);
  const versions = usePlanStore((state) => state.versions);
  const actuals = usePlanStore((state) => state.actuals);
  const planName = usePlanStore((state) => state.plan?.name ?? 'plan');

  const [metric, setMetric] = useState<MetricKey>('omzet');
  const [comparison, setComparison] = useState<ComparisonBasis>('baseline');
  const [toleranceBp, setToleranceBp] = useState(1000);
  const [window, setWindow] = useState<3 | 6 | 12>(6);
  const [evolutionMonth, setEvolutionMonth] = useState(1);

  const horizonMonths = result?.meta.horizonMonths ?? 36;
  const months = useMemo(() => result?.meta.months ?? [], [result]);

  const accuracy = useMemo(
    () =>
      buildAccuracy(versions, actuals, {
        metric,
        comparison,
        toleranceBp,
        window,
        legalForm: input.company.legalForm,
        horizonMonths,
        startMonth: input.assumptions.startMonth,
        minimumCashBufferCents: input.assumptions.minimumCashBufferCents,
      }),
    [versions, actuals, metric, comparison, toleranceBp, window, input, horizonMonths],
  );

  const points = useMemo(() => toChartData(accuracy, months), [accuracy, months]);
  const summary = describeAccuracy(accuracy, METRIC_LABELS[metric]);

  if (versions.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Card title="Prognose versus realisatie" description="Beschikbaar zodra je een prognose hebt vastgezet.">
          <p className="text-sm leading-relaxed text-slate-700">
            Zet je prognose vast op het moment dat je hem indient. Daarna vul je elke maand je werkelijke cijfers in en
            zie je hoe dicht je erbij zat. Dat levert twee dingen op: je merkt vroeg wanneer je kas afwijkt van je plan,
            en je bouwt een bewijs op dat je prognoses kloppen. Dat helpt bij je volgende aanvraag.
          </p>
        </Card>
        {result !== null && <LockVersionCard result={result} versions={versions} />}
      </div>
    );
  }

  const evolution = forecastEvolution(versions, metric, evolutionMonth);
  const actualForMonth =
    metricSeriesFromActuals(actuals, input.company.legalForm, horizonMonths)[metric][evolutionMonth] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Prognose versus realisatie"
        description="Hoe dicht zat je erbij, en wat betekent dat voor de rest van het jaar?"
        actions={
          result === null ? undefined : (
            <Button
              onClick={() => {
                void (async () => {
                  const { downloadProgressReport } = await import('../../exports/pdf/renderProgressReport');
                  await downloadProgressReport({
                    input,
                    result,
                    accuracy,
                    months,
                    metric,
                    planName,
                    preparedOn: new Date().toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }),
                  });
                })();
              }}
            >
              <Download className="size-4" aria-hidden /> Voortgangsrapportage
            </Button>
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Waar kijk je naar?">
            {({ id }) => (
              <Select
                id={id}
                value={metric}
                options={METRIC_KEYS.map((key) => ({ value: key, label: METRIC_LABELS[key] }))}
                onChange={(event) => {
                  setMetric(event.target.value as MetricKey);
                }}
              />
            )}
          </Field>
          <Field label="Vergelijken met">
            {({ id }) => (
              <Select
                id={id}
                value={comparison}
                options={COMPARISONS}
                onChange={(event) => {
                  setComparison(event.target.value as ComparisonBasis);
                }}
              />
            )}
          </Field>
          <Field label="Bandbreedte" hint="Binnen deze marge noemen we het op koers.">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={String(toleranceBp)}
                options={TOLERANCES}
                onChange={(event) => {
                  setToleranceBp(Number(event.target.value));
                }}
              />
            )}
          </Field>
          <Field label="Kengetallen over">
            {({ id }) => (
              <Select
                id={id}
                value={String(window)}
                options={[
                  { value: '3', label: 'laatste 3 maanden' },
                  { value: '6', label: 'laatste 6 maanden' },
                  { value: '12', label: 'laatste 12 maanden' },
                ]}
                onChange={(event) => {
                  setWindow(Number(event.target.value) as 3 | 6 | 12);
                }}
              />
            )}
          </Field>
        </div>
      </Card>

      <KpiTiles accuracy={accuracy} metric={metric} />

      {accuracy.insights.length > 0 && (
        <Card title="Wat de cijfers zeggen">
          <ul className="flex flex-col gap-2">
            {accuracy.insights.map((insight) => (
              <li key={insight.ruleId}>
                <Callout tone={insight.severity === 'warning' ? 'warning' : 'info'}>
                  {INSIGHT_TEXTS[insight.ruleId]?.(insight.params) ?? insight.ruleId}
                </Callout>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ChartFrame
        title={METRIC_LABELS[metric]}
        description="Gestreept is je prognose, de doorgetrokken lijn je realisatie, gestippeld je bijgestelde prognose."
        summary={summary}
        table={accuracyTable(points, metric)}
      >
        <AccuracyChart points={points} metric={metric} lastClosedMonth={accuracy.lastClosedMonth} />
      </ChartFrame>

      <ChartFrame
        title="Afwijking per maand"
        description="Grijs is binnen je bandbreedte, groen een meevaller, oranje een tegenvaller."
        summary={`Afwijking per maand in procenten van de prognose voor ${METRIC_LABELS[metric].toLowerCase()}.`}
        table={{
          columns: ['Maand', 'Afwijking %', 'Oordeel'],
          rows: points
            .filter((point) => point.deviationPct !== null)
            .map((point) => [
              point.label,
              `${((point.deviationPct ?? 0) * 100).toFixed(1)}%`,
              point.status ?? '—',
            ]),
        }}
      >
        <DeviationChart points={points} metric={metric} />
      </ChartFrame>

      <ChartFrame
        title="Hoe je verwachting schoof"
        description="Voor één maand: wat je er in elke versie van dacht, en waar hij uitkwam."
        summary={`Verwachting voor maand ${evolutionMonth} door ${evolution.length} versies heen, tegenover de werkelijke uitkomst.`}
        table={{
          columns: ['Versie', 'Gemaakt op', 'Verwachting'],
          rows: evolution.map((point) => [
            `v${point.versionNo}`,
            point.createdOn,
            formatMetricValue(point.value, metric),
          ]),
        }}
        actions={
          <Field label="Maand" className="w-44">
            {({ id }) => (
              <Select
                id={id}
                value={String(evolutionMonth)}
                options={Array.from({ length: horizonMonths }, (_, index) => ({
                  value: String(index + 1),
                  label: monthLabel(months[index + 1], index + 1),
                }))}
                onChange={(event) => {
                  setEvolutionMonth(Number(event.target.value));
                }}
              />
            )}
          </Field>
        }
      >
        <EvolutionChart points={evolution} actual={actualForMonth} metric={metric} />
      </ChartFrame>

      <ActualsForm months={months} actuals={actuals} horizonMonths={horizonMonths} />
      <CsvImport startMonth={input.assumptions.startMonth} horizonMonths={horizonMonths} />

      {result !== null && <LockVersionCard result={result} versions={versions} />}

      <Card title="Versies" description="Elke vastgezette prognose blijft bewaard zoals hij was.">
        <ul className="divide-y divide-slate-100 text-sm">
          {[...versions]
            .sort((left, right) => right.versionNo - left.versionNo)
            .map((version) => (
              <li key={version.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2">
                <div>
                  <span className="font-medium text-slate-800">
                    v{version.versionNo} · {version.kind === 'baseline' ? 'ingediend' : 'bijgesteld'}
                  </span>
                  {version.note !== null && <span className="ml-2 text-slate-600">{version.note}</span>}
                </div>
                <span className="text-xs text-slate-500">
                  {version.createdOn} · vanaf {formatYearMonth(version.startMonth)}
                </span>
              </li>
            ))}
        </ul>
        {latestVersion(versions)?.kind === 'baseline' && (
          <p className="mt-3 text-xs text-slate-500">
            Zodra je maanden afsluit, kun je een nieuwe prognose maken die verdergaat vanaf je werkelijke cijfers.
          </p>
        )}
      </Card>
    </div>
  );
}
