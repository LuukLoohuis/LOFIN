import { Callout } from '../../components/ui/Callout';
import { Card } from '../../components/ui/Card';
import { TrafficLight } from '../../components/ui/TrafficLight';
import { DISCLAIMER } from '../../config';
import { usePlanStore } from '../../data/planStore';
import type { Light, PlanResult } from '../../engine';
import { formatCents, formatNumber, formatYearMonth } from '../../lib/format';
import { useWizard } from '../wizard/context';
import { usePlanResult } from '../wizard/usePlanResult';
import { ExportButtons } from './ExportButtons';
import { CashflowSection } from './sections/CashflowSection';
import { ChecklistSection } from './sections/ChecklistSection';
import { FundingSection } from './sections/FundingSection';
import { LoansSection } from './sections/LoansSection';
import { PnlSection } from './sections/PnlSection';
import { RatiosSection } from './sections/RatiosSection';
import { ReadinessSection } from './sections/ReadinessSection';
import { ScenariosSection } from './sections/ScenariosSection';

export function ResultPage() {
  const { input } = useWizard();
  const planName = usePlanStore((state) => state.plan?.name ?? 'plan');
  const result = usePlanResult(input);

  if (result === null) {
    return (
      <Callout tone="warning" title="Nog niet door te rekenen">
        Controleer de eerste prognosemaand in stap 4.
      </Callout>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Je dossier als pdf voor de financier, of als Excel met formules voor je boekhouder.
        </p>
        <ExportButtons input={input} result={result} planName={planName} />
      </div>
      <Headline result={result} />
      <ReadinessSection result={result} />
      <FundingSection result={result} />
      <PnlSection result={result} />
      <CashflowSection result={result} />
      <LoansSection result={result} />
      <RatiosSection result={result} />
      <ScenariosSection result={result} />
      <ChecklistSection result={result} />
      <p className="text-xs leading-relaxed text-slate-500">{DISCLAIMER}</p>
    </div>
  );
}

function Headline({ result }: { result: PlanResult }) {
  const year1 = result.pnl.periods.find((row) => row.period === 'y1');
  const dscr = result.ratios.dscr.find((ratio) => ratio.period === 'y1');
  const lowestMonth = result.meta.months[result.ratios.lowestCash.month];

  return (
    <Card title="Je plan in vier getallen">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Financieringsbehoefte" value={formatCents(result.financingNeed.financingNeed)} />
        <Metric label="Omzet jaar 1" value={formatCents(year1?.revenue ?? 0)} />
        <Metric
          label="DSCR jaar 1"
          value={dscr?.value === null || dscr === undefined ? '—' : formatNumber(dscr.value, 2)}
          light={dscr?.light}
        />
        <Metric
          label="Laagste kassaldo"
          value={formatCents(result.ratios.lowestCash.amount)}
          light={result.ratios.lowestCash.light}
          note={
            lowestMonth === undefined
              ? undefined
              : formatYearMonth(`${lowestMonth.year}-${String(lowestMonth.month).padStart(2, '0')}`)
          }
        />
      </dl>
    </Card>
  );
}

function Metric({
  label,
  value,
  light,
  note,
}: {
  label: string;
  value: string;
  light?: Light | undefined;
  note?: string | undefined;
}) {
  const color = light === 'rood' ? 'text-red-700' : light === 'oranje' ? 'text-amber-700' : 'text-slate-900';
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</dd>
      {note !== undefined && <p className="text-xs text-slate-500">{note}</p>}
      {light !== undefined && light !== 'geen' && <TrafficLight light={light} className="mt-1" />}
    </div>
  );
}
