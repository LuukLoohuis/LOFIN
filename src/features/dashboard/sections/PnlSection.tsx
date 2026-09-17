import { Card } from '../../../components/ui/Card';
import { FinancialTable } from '../../../components/ui/FinancialTable';
import { PERIOD_LABELS } from '../../../config/texts';
import type { PlanResult, PnlRow } from '../../../engine';
import { moneyRows, type MoneyRow } from '../rows';

const COST_LABELS = {
  huur: 'Huisvesting',
  vervoer: 'Vervoer',
  verzekeringen: 'Verzekeringen',
  telefoon_software: 'Telefoon en software',
  accountant: 'Boekhouder',
  marketing: 'Marketing',
  overig: 'Overig',
} as const;

export function PnlSection({ result }: { result: PlanResult }) {
  const periods = result.pnl.periods;
  const columns = periods.map((period) => PERIOD_LABELS[period.period] ?? period.period);
  const each = (pick: (row: PnlRow) => number) => periods.map(pick);

  const rows: MoneyRow[] = [
    { label: 'Omzet', amounts: each((row) => row.revenue) },
    { label: 'Inkoopwaarde', amounts: each((row) => -row.costOfSales) },
    { label: 'Brutomarge', amounts: each((row) => row.grossMargin), emphasis: true },
    ...Object.entries(COST_LABELS).map(
      ([key, label]): MoneyRow => ({
        label,
        amounts: each((row) => -row.fixedCosts[key as keyof typeof COST_LABELS]),
        indent: true,
      }),
    ),
    { label: 'Vaste kosten', amounts: each((row) => -row.fixedCostsTotal) },
    { label: 'Personeel', amounts: each((row) => -row.staff) },
    { label: 'Eenmalige kosten', amounts: each((row) => -row.oneOffCosts) },
    { label: 'Afschrijving', amounts: each((row) => -row.depreciation) },
    { label: 'Bedrijfsresultaat', amounts: each((row) => row.ebit), emphasis: true },
    { label: 'Rente', amounts: each((row) => -row.interest) },
    { label: 'Resultaat voor belasting', amounts: each((row) => row.resultBeforeTax), emphasis: true },
    ...(result.meta.legalForm === 'bv'
      ? [
          { label: 'Vennootschapsbelasting', amounts: each((row) => -row.corporateTax) },
          { label: 'Nettowinst', amounts: each((row) => row.netResult), emphasis: true },
          { label: 'Dividend', amounts: each((row) => -row.dividend) },
        ]
      : [{ label: 'Privé-opnamen', amounts: each((row) => -row.privateWithdrawals) }]),
    { label: 'Kasstroom voor rente en aflossing', amounts: each((row) => row.cfads), emphasis: true },
    { label: 'Rente en aflossing', amounts: each((row) => -row.debtService) },
  ];

  return (
    <Card title="Exploitatiebegroting" description="Wat je verdient en uitgeeft per boekjaar. Bedragen exclusief btw.">
      <FinancialTable columns={columns} rows={moneyRows(rows)} />
    </Card>
  );
}
