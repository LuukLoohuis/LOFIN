import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { FinancialTable } from '../../../components/ui/FinancialTable';
import { PERIOD_LABELS } from '../../../config/texts';
import type { CashRow, PeriodKey, PlanResult } from '../../../engine';
import { moneyRows, type MoneyRow } from '../rows';

const MONTH_ABBREVIATIONS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function CashflowSection({ result }: { result: PlanResult }) {
  const firstPeriod = result.meta.periods[0]?.key ?? 'y1';
  const [period, setPeriod] = useState<PeriodKey>(firstPeriod);
  const selected = result.meta.periods.find((candidate) => candidate.key === period);

  const monthsInPeriod =
    selected === undefined
      ? []
      : result.meta.months.filter(
          (meta) =>
            (meta.index === 0 && selected.key === firstPeriod) ||
            (meta.index >= selected.firstMonth && meta.index <= selected.lastMonth),
        );

  const columns = monthsInPeriod.map((meta) =>
    meta.index === 0 ? 'start' : `${MONTH_ABBREVIATIONS[meta.month - 1] ?? ''} ${String(meta.year).slice(2)}`,
  );
  const cashRows = monthsInPeriod.map((meta) => result.cashflow.monthly[meta.index]);
  const each = (pick: (row: CashRow) => number) => cashRows.map((row) => (row === undefined ? 0 : pick(row)));
  const goesNegative = cashRows.some((row) => (row?.closingCash ?? 0) < 0);

  const rows: MoneyRow[] = [
    { label: 'Beginsaldo', amounts: each((row) => row.openingCash) },
    { label: 'Van klanten', amounts: each((row) => row.receipts.customers), indent: true },
    { label: 'Financiering', amounts: each((row) => row.receipts.financing), indent: true },
    { label: 'Eigen inbreng', amounts: each((row) => row.receipts.ownContribution), indent: true },
    { label: 'Subsidies', amounts: each((row) => row.receipts.grants), indent: true },
    { label: 'Btw-teruggaaf', amounts: each((row) => row.receipts.vatRefund), indent: true },
    { label: 'Ontvangsten', amounts: each((row) => row.receipts.total), emphasis: true },
    { label: 'Inkoop', amounts: each((row) => -row.payments.operations.costOfSales), indent: true },
    { label: 'Vaste kosten', amounts: each((row) => -row.payments.operations.fixedCosts), indent: true },
    { label: 'Personeel', amounts: each((row) => -row.payments.operations.staff), indent: true },
    { label: 'Eenmalige kosten', amounts: each((row) => -row.payments.operations.oneOffCosts), indent: true },
    { label: 'Btw-afdracht', amounts: each((row) => -row.payments.vat), indent: true },
    { label: 'Investeringen', amounts: each((row) => -row.payments.investments), indent: true },
    { label: 'Rente', amounts: each((row) => -row.payments.interest), indent: true },
    { label: 'Aflossing', amounts: each((row) => -row.payments.repayments), indent: true },
    { label: 'Privé-opnamen', amounts: each((row) => -row.payments.privateWithdrawals), indent: true },
    { label: 'Vennootschapsbelasting', amounts: each((row) => -row.payments.corporateTax), indent: true },
    { label: 'Dividend', amounts: each((row) => -row.payments.dividend), indent: true },
    { label: 'Uitgaven', amounts: each((row) => -row.payments.total), emphasis: true },
    { label: 'Mutatie', amounts: each((row) => row.netCashflow) },
    {
      label: 'Eindsaldo',
      amounts: each((row) => row.closingCash),
      emphasis: true,
      tone: goesNegative ? 'negative' : 'default',
    },
    { label: 'Opgenomen krediet', amounts: each((row) => row.creditDrawn) },
    { label: 'Tekort boven de limiet', amounts: each((row) => row.shortfall), tone: 'negative' },
  ];

  return (
    <Card
      title="Liquiditeitsbegroting"
      description="Wat er per maand binnenkomt en uitgaat, inclusief btw. Hier zie je of het geld op enig moment opraakt."
      actions={
        <div className="flex flex-wrap gap-1">
          {result.meta.periods.map((candidate) => (
            <Button
              key={candidate.key}
              variant={candidate.key === period ? 'primary' : 'ghost'}
              onClick={() => {
                setPeriod(candidate.key);
              }}
            >
              {candidate.key === 'start'
                ? `Start ${candidate.calendarYear}`
                : `${PERIOD_LABELS[candidate.key] ?? ''} · ${candidate.calendarYear}`}
            </Button>
          ))}
        </div>
      }
    >
      <FinancialTable columns={columns} rows={moneyRows(rows)} rowHeader="Kasstroom" />
    </Card>
  );
}
