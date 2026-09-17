import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { TrafficLight } from '../../../components/ui/TrafficLight';
import { PERIOD_LABELS, RATIO_DISCLAIMER, RATIO_HELP, type RatioHelp } from '../../../config/texts';
import type { Light, PlanResult } from '../../../engine';
import { formatCents, formatNumber, formatPercent, formatYearMonth } from '../../../lib/format';

export function RatiosSection({ result }: { result: PlanResult }) {
  const { ratios } = result;
  const lowestMonth = result.meta.months[ratios.lowestCash.month];
  const solvencyEnd = ratios.solvency.at(-1);
  const breakEvenYear1 = ratios.breakEven.find((row) => row.period === 'y1') ?? ratios.breakEven[0];

  return (
    <Card
      title="Waar een financier naar kijkt"
      description={RATIO_DISCLAIMER}
      className="bg-white"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <RatioCard
          help={RATIO_HELP.dscr}
          light={ratios.dscr.at(-1)?.light ?? 'geen'}
          value={
            <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
              {ratios.dscr.map((ratio) => (
                <li key={ratio.period} className="text-sm text-slate-700">
                  <span className="text-xs text-slate-500">{PERIOD_LABELS[ratio.period]}</span>{' '}
                  <strong className="font-semibold tabular-nums">
                    {ratio.value === null ? '—' : formatNumber(ratio.value, 2)}
                  </strong>
                </li>
              ))}
            </ul>
          }
        />

        <RatioCard
          help={RATIO_HELP.lowestCash}
          light={ratios.lowestCash.light}
          value={
            <p className="mt-1 text-sm text-slate-700">
              <strong className="text-lg font-semibold tabular-nums text-slate-900">
                {formatCents(ratios.lowestCash.amount)}
              </strong>{' '}
              in{' '}
              {lowestMonth === undefined
                ? 'de startmaand'
                : formatYearMonth(`${lowestMonth.year}-${String(lowestMonth.month).padStart(2, '0')}`)}
              {ratios.lowestCash.creditLimit > 0 && (
                <span className="block text-xs text-slate-500">
                  Kredietruimte op dat moment: {formatCents(ratios.lowestCash.creditLimit)}
                </span>
              )}
            </p>
          }
        />

        <RatioCard
          help={RATIO_HELP.breakEven}
          light="geen"
          value={
            <p className="mt-1 text-sm text-slate-700">
              <strong className="text-lg font-semibold tabular-nums text-slate-900">
                {breakEvenYear1?.revenue === null || breakEvenYear1 === undefined
                  ? '—'
                  : formatCents(breakEvenYear1.revenue)}
              </strong>{' '}
              <span className="text-xs text-slate-500">
                tegenover een geplande omzet van {formatCents(breakEvenYear1?.actualRevenue ?? 0)}
              </span>
              {breakEvenYear1?.revenueInclWithdrawals != null && (
                <span className="block text-xs text-slate-500">
                  Inclusief je privé-opnamen: {formatCents(breakEvenYear1.revenueInclWithdrawals)}
                </span>
              )}
            </p>
          }
        />

        <RatioCard
          help={RATIO_HELP.solvency}
          light={solvencyEnd?.light ?? 'geen'}
          value={
            <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
              {ratios.solvency.map((ratio) => (
                <li key={ratio.period} className="text-sm text-slate-700">
                  <span className="text-xs text-slate-500">{PERIOD_LABELS[ratio.period]}</span>{' '}
                  <strong className="font-semibold tabular-nums">
                    {ratio.value === null ? '—' : formatPercent(Math.round(ratio.value * 10_000), 0)}
                  </strong>
                </li>
              ))}
            </ul>
          }
        />

        <RatioCard
          help={RATIO_HELP.debtToCashflow}
          light={ratios.debtToCashflow.light}
          value={
            <p className="mt-1 text-sm text-slate-700">
              <strong className="text-lg font-semibold tabular-nums text-slate-900">
                {ratios.debtToCashflow.value === null ? '—' : `${formatNumber(ratios.debtToCashflow.value, 1)} jaar`}
              </strong>{' '}
              <span className="text-xs text-slate-500">
                schuld {formatCents(ratios.debtToCashflow.debt)} · kasstroom {formatCents(ratios.debtToCashflow.cfads)}
              </span>
            </p>
          }
        />
      </div>
    </Card>
  );
}

function RatioCard({ help, light, value }: { help: RatioHelp; light: Light; value: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-md border border-slate-200 p-4">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{help.title}</h3>
        {light !== 'geen' && <TrafficLight light={light} />}
      </header>
      {value}
      <p className="mt-2 text-xs text-slate-500">{help.what}</p>
      <button
        type="button"
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        Waarom kijkt een financier hiernaar?
        <ChevronDown className={`size-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <p className="mt-2 text-xs leading-relaxed text-slate-600">{help.why}</p>}
    </section>
  );
}
