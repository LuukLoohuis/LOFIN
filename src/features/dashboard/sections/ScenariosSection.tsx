import { Callout } from '../../../components/ui/Callout';
import { Card } from '../../../components/ui/Card';
import { FinancialTable, type FinancialRow } from '../../../components/ui/FinancialTable';
import { PERIOD_LABELS, SCENARIO_LABELS } from '../../../config/texts';
import type { PlanResult } from '../../../engine';
import { formatCents, formatNumber, formatPercent, formatYearMonth } from '../../../lib/format';

export function ScenariosSection({ result }: { result: PlanResult }) {
  const columns = result.scenarios.map((scenario) => SCENARIO_LABELS[scenario.key] ?? scenario.key);

  const monthName = (month: number | null) => {
    if (month === null) return 'nooit';
    const meta = result.meta.months[month];
    return meta === undefined ? '—' : formatYearMonth(`${meta.year}-${String(meta.month).padStart(2, '0')}`);
  };

  const rows: FinancialRow[] = [
    {
      label: 'Omzetverschil',
      values: result.scenarios.map((scenario) =>
        scenario.revenueDeltaBp === 0 ? '—' : formatPercent(scenario.revenueDeltaBp, 0),
      ),
    },
    { label: 'Omzet over drie jaar', values: result.scenarios.map((scenario) => formatCents(scenario.revenue)) },
    ...(result.scenarios[0]?.dscr ?? []).map(
      (ratio, index): FinancialRow => ({
        label: `DSCR ${PERIOD_LABELS[ratio.period]?.toLowerCase() ?? ratio.period}`,
        values: result.scenarios.map((scenario) => {
          const value = scenario.dscr[index]?.value;
          return value === null || value === undefined ? '—' : formatNumber(value, 2);
        }),
        indent: true,
      }),
    ),
    {
      label: 'Laagste kassaldo',
      values: result.scenarios.map((scenario) => formatCents(scenario.lowestCash.amount)),
      emphasis: true,
      tone: result.scenarios.some((scenario) => scenario.lowestCash.amount < 0) ? 'negative' : 'default',
    },
    {
      label: 'Onder nul vanaf',
      values: result.scenarios.map((scenario) => monthName(scenario.firstNegativeMonth)),
    },
    {
      label: 'Buiten je kredietruimte vanaf',
      values: result.scenarios.map((scenario) => monthName(scenario.firstShortfallMonth)),
    },
  ];

  const pessimistic = result.scenarios.find((scenario) => scenario.key === 'pessimistisch');

  return (
    <Card
      title="Scenario's"
      description="Een financier rekent zelf ook een tegenvaller door. Alleen de omzet verschuift; de inkoop beweegt mee."
    >
      <FinancialTable columns={columns} rows={rows} rowHeader="Scenario" />
      {pessimistic !== undefined && (
        <div className="mt-4">
          {pessimistic.firstShortfallMonth === null ? (
            <Callout tone="success">
              Ook met {formatPercent(Math.abs(pessimistic.revenueDeltaBp), 0)} minder omzet blijf je binnen je
              financiering.
            </Callout>
          ) : (
            <Callout tone="warning" title="In het pessimistische scenario kom je geld tekort">
              Vanaf {monthName(pessimistic.firstShortfallMonth)} is er meer nodig dan je financiering dekt. Een grotere
              buffer, een krediet of lagere privé-opnamen maken het verschil.
            </Callout>
          )}
        </div>
      )}
    </Card>
  );
}
