import { PERIOD_LABELS } from '../config/texts';
import type { CashRow, Cents, FiscalPeriod, MonthMeta, PlanResult, PnlRow } from '../engine';

export interface AmountRow {
  label: string;
  amounts: readonly Cents[];
  emphasis?: boolean;
  indent?: boolean;
}

export interface AmountTable {
  columns: readonly string[];
  rows: readonly AmountRow[];
  rowHeader: string;
}

const MONTH_ABBREVIATIONS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const COST_LABELS = {
  huur: 'Huisvesting',
  vervoer: 'Vervoer',
  verzekeringen: 'Verzekeringen',
  telefoon_software: 'Telefoon en software',
  accountant: 'Boekhouder',
  marketing: 'Marketing',
  overig: 'Overig',
} as const;

const INVESTMENT_LABELS = {
  bedrijfsmiddel: 'Bedrijfsmiddelen',
  verbouwing: 'Verbouwing',
  voorraad: 'Voorraad',
  immaterieel: 'Immateriële activa',
  overig: 'Overig',
} as const;

export function monthLabel(meta: MonthMeta): string {
  return meta.index === 0 ? 'start' : `${MONTH_ABBREVIATIONS[meta.month - 1] ?? ''} ${String(meta.year).slice(2)}`;
}

export function periodLabel(period: FiscalPeriod): string {
  return period.key === 'start' ? `Start ${period.calendarYear}` : `${period.calendarYear}`;
}

/** Exploitatiebegroting per boekjaar. */
export function pnlTable(result: PlanResult): AmountTable {
  const periods = result.pnl.periods;
  const each = (pick: (row: PnlRow) => number) => periods.map(pick);
  const isBv = result.meta.legalForm === 'bv';

  return {
    rowHeader: 'Post',
    columns: periods.map((period) => PERIOD_LABELS[period.period] ?? period.period),
    rows: [
      { label: 'Omzet', amounts: each((row) => row.revenue) },
      { label: 'Inkoopwaarde', amounts: each((row) => -row.costOfSales) },
      { label: 'Brutomarge', amounts: each((row) => row.grossMargin), emphasis: true },
      ...Object.entries(COST_LABELS).map(
        ([key, label]): AmountRow => ({
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
      ...(isBv
        ? [
            { label: 'Vennootschapsbelasting', amounts: each((row) => -row.corporateTax) },
            { label: 'Nettowinst', amounts: each((row) => row.netResult), emphasis: true },
            { label: 'Dividend', amounts: each((row) => -row.dividend) },
          ]
        : [{ label: 'Privé-opnamen', amounts: each((row) => -row.privateWithdrawals) }]),
      { label: 'Kasstroom voor rente en aflossing', amounts: each((row) => row.cfads), emphasis: true },
      { label: 'Rente en aflossing', amounts: each((row) => -row.debtService) },
    ],
  };
}

function cashRows(rows: readonly (CashRow | undefined)[]): AmountRow[] {
  const each = (pick: (row: CashRow) => number) => rows.map((row) => (row === undefined ? 0 : pick(row)));
  return [
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
    { label: 'Eindsaldo', amounts: each((row) => row.closingCash), emphasis: true },
    { label: 'Opgenomen krediet', amounts: each((row) => row.creditDrawn) },
    { label: 'Tekort boven de limiet', amounts: each((row) => row.shortfall) },
  ];
}

/** Liquiditeit per maand voor de opgegeven maanden. */
export function cashflowMonthlyTable(result: PlanResult, months: readonly MonthMeta[]): AmountTable {
  return {
    rowHeader: 'Kasstroom',
    columns: months.map(monthLabel),
    rows: cashRows(months.map((meta) => result.cashflow.monthly[meta.index])),
  };
}

/** Liquiditeit per kwartaal, bijvoorbeeld voor de jaren na het eerste. */
export function cashflowQuarterlyTable(result: PlanResult, fromMonth: number): AmountTable {
  const firstMonthOfQuarter = new Map<string, number>();
  for (const meta of result.meta.months) {
    const key = `${meta.year}-${meta.quarter}`;
    if (!firstMonthOfQuarter.has(key)) firstMonthOfQuarter.set(key, meta.index);
  }
  const quarters = result.cashflow.quarterly.filter(
    (quarter) => (firstMonthOfQuarter.get(`${quarter.year}-${quarter.quarter}`) ?? 0) >= fromMonth,
  );
  return {
    rowHeader: 'Kasstroom',
    columns: quarters.map((quarter) => `Q${quarter.quarter} ${String(quarter.year).slice(2)}`),
    rows: cashRows(quarters),
  };
}

export function fundingTables(result: PlanResult): { uses: AmountTable; sources: AmountTable } {
  const { uses, sources } = result.financingNeed;
  return {
    uses: {
      rowHeader: 'Bestedingen',
      columns: ['Bedrag'],
      rows: [
        ...Object.entries(INVESTMENT_LABELS).map(
          ([key, label]): AmountRow => ({
            label,
            amounts: [uses.investmentsByCategory[key as keyof typeof INVESTMENT_LABELS]],
            indent: true,
          }),
        ),
        { label: 'Investeringen', amounts: [uses.investments] },
        { label: 'Werkkapitaal', amounts: [uses.workingCapital] },
        { label: 'Eenmalige kosten', amounts: [uses.oneOffCosts] },
        { label: 'Totaal nodig', amounts: [uses.total], emphasis: true },
      ],
    },
    sources: {
      rowHeader: 'Bronnen',
      columns: ['Bedrag'],
      rows: [
        { label: 'Eigen inbreng', amounts: [sources.ownContribution] },
        { label: 'Subsidies en schenkingen', amounts: [sources.grants] },
        { label: 'Al geregelde financiering', amounts: [sources.otherFinancing] },
        { label: 'Aangevraagde financiering', amounts: [sources.requestedFinancing] },
        { label: 'Totaal beschikbaar', amounts: [sources.total], emphasis: true },
      ],
    },
  };
}

/** Rente, aflossing en restschuld per boekjaar, per financieringsregel. */
export function loanTables(result: PlanResult): { title: string; subtitle: string; table: AmountTable }[] {
  const columns = result.meta.periods.map((period) => PERIOD_LABELS[period.key] ?? period.key);
  return [
    ...result.loans.map((loan) => ({
      title: loan.description === '' ? 'Financiering' : loan.description,
      subtitle: `${loan.kind.replace('_', ' ')} · ${loan.termMonths} maanden`,
      table: {
        rowHeader: 'Post',
        columns,
        rows: [
          { label: 'Rente', amounts: loan.periods.map((period) => period.interest) },
          { label: 'Aflossing', amounts: loan.periods.map((period) => period.principal) },
          {
            label: 'Restschuld per 31-12',
            amounts: loan.periods.map((period) => period.closingBalance),
            emphasis: true,
          },
        ],
      } satisfies AmountTable,
    })),
    ...result.creditLines.map((credit) => ({
      title: credit.description === '' ? 'Rekening-courantkrediet' : credit.description,
      subtitle: 'krediet',
      table: {
        rowHeader: 'Post',
        columns,
        rows: [
          { label: 'Rente over de roodstand', amounts: credit.periods.map((period) => period.interest) },
          {
            label: 'Opgenomen per 31-12',
            amounts: credit.periods.map((period) => period.closingBalance),
            emphasis: true,
          },
        ],
      } satisfies AmountTable,
    })),
  ];
}

/** Maanden van het eerste volle boekjaar, inclusief het startmoment en een eventuele startperiode. */
export function firstYearMonths(result: PlanResult): MonthMeta[] {
  const firstFullYear = result.meta.periods.find((period) => period.key === 'y1');
  const last = firstFullYear?.lastMonth ?? result.meta.horizonMonths;
  return result.meta.months.filter((meta) => meta.index <= last);
}
