import type ExcelJS from 'exceljs';
import type { PlanInput, PlanResult } from '../../engine';
import { cell, euros, factor, range } from './cells';

export const MONEY_FORMAT = '#,##0.00';

export interface AssumptionRefs {
  revenueBase: string;
  monthlyGrowth: string;
  rampUpMonths: string;
  revenueGrowth: [string, string];
  costGrowth: [string, string];
  seasonality: string;
  costOfSales: string;
  vatRevenue: string;
  vatCostOfSales: string;
  debtorWholeMonths: string;
  debtorShare: string;
  creditorWholeMonths: string;
  creditorShare: string;
  withdrawals: string;
  openingCash: string;
  openingReceivables: string;
  openingPayables: string;
}

export interface MonthGrid {
  sheetName: string;
  firstColumn: number;
  lastColumn: number;
  rows: Record<string, number>;
  loans: { lineId: string; description: string; interestRow: number; principalRow: number; balanceRow: number }[];
  credits: { lineId: string; description: string; interestRow: number; drawnRow: number }[];
}

/** Aantal rijen dat na de kredietregels nog volgt; nodig om vooruit te kunnen verwijzen. */
const ROWS_AFTER_CREDITS = 17;

/**
 * Het maandmodel: wat de rekenkern doet, maar dan als celformules die naar Aannames wijzen.
 * Verander je daar een aanname, dan rekent Excel dit blad en alle overzichten opnieuw.
 * Waar we de uitkomst al kennen, staat die als resultaat in de cel; de rest rekent Excel uit
 * zodra je het bestand opent.
 */
export function writeMonthsSheet(
  sheet: ExcelJS.Worksheet,
  input: PlanInput,
  result: PlanResult,
  refs: AssumptionRefs,
  firstColumn: number,
): MonthGrid {
  const metas = result.meta.months;
  const columns = metas.map((_, index) => firstColumn + index);
  const lastColumn = firstColumn + metas.length - 1;
  const rows: Record<string, number> = {};
  const isBv = input.company.legalForm === 'bv';
  let nextRow = 0;

  const rowRange = (row: number) => range(firstColumn, row, lastColumn, row, sheet.name);
  const here = (row: number, column: number) => cell(column, row);
  const before = (row: number, column: number) => (column > firstColumn ? cell(column - 1, row) : null);

  type Fill = (column: number, index: number, row: number) => ExcelJS.CellValue;

  const addRow = (
    key: string,
    label: string,
    fill: Fill,
    options: { bold?: boolean; format?: string; parameter?: number | string } = {},
  ): number => {
    nextRow += 1;
    const row = nextRow;
    rows[key] = row;
    const target = sheet.getRow(row);
    target.getCell(1).value = label;
    if (options.parameter !== undefined) target.getCell(2).value = options.parameter;
    if (options.bold === true) target.getCell(1).font = { bold: true };
    for (const [index, column] of columns.entries()) {
      const targetCell = target.getCell(column);
      targetCell.value = fill(column, index, row);
      targetCell.numFmt = options.format ?? MONEY_FORMAT;
      if (options.bold === true) targetCell.font = { bold: true };
    }
    return row;
  };

  /** Een formule, met de uitkomst van de rekenkern erbij als we die kennen. */
  const f = (text: string, value?: number): ExcelJS.CellValue =>
    value === undefined ? { formula: text } : { formula: text, result: value };

  const pnl = (index: number) => result.pnl.monthly[index];
  const cash = (index: number) => result.cashflow.monthly[index];

  // Hulpgegevens per maand
  const monthIndexRow = addRow('monthIndex', 'Maandnummer', (_c, index) => metas[index]?.index ?? 0, { format: '0' });
  addRow('year', 'Kalenderjaar', (_c, index) => metas[index]?.year ?? 0, { format: '0' });
  const calendarMonthRow = addRow('calendarMonth', 'Kalendermaand', (_c, index) => metas[index]?.month ?? 0, {
    format: '0',
  });
  const periodRow = addRow('period', 'Boekjaar', (_c, index) => metas[index]?.period ?? '', { format: '@' });
  const positionRow = addRow('position', 'Maand binnen de periode', (_c, index) => positionInPeriod(result, index), {
    format: '0',
  });
  const vatPeriodRow = addRow('vatPeriod', 'Aangifteperiode', (_c, index) => vatPeriodKey(result, index, input), {
    format: '0',
  });

  const revenueFactorRow = addRow(
    'revenueFactor',
    'Groeifactor omzet',
    (column, index) =>
      f(
        growthFormula(here(periodRow, column), refs.revenueGrowth),
        growthValue(result, index, factor(input.assumptions.revenueGrowthBp.y2), factor(input.assumptions.revenueGrowthBp.y3)),
      ),
    { format: '0.0000' },
  );
  const costFactorRow = addRow(
    'costFactor',
    'Groeifactor kosten',
    (column, index) =>
      f(
        growthFormula(here(periodRow, column), refs.costGrowth),
        growthValue(result, index, factor(input.assumptions.costGrowthBp.y2), factor(input.assumptions.costGrowthBp.y3)),
      ),
    { format: '0.0000' },
  );

  // Omzet
  const levelRow = addRow('revenueLevel', 'Omzetniveau', (column, index) =>
    f(
      `IF(${here(monthIndexRow, column)}=0,0,${refs.revenueBase}*(1+${refs.monthlyGrowth})^(MIN(${here(monthIndexRow, column)},${refs.rampUpMonths})-1)*${here(revenueFactorRow, column)})`,
      revenueLevelValue(input, result, index),
    ),
  );
  const revenueRow = addRow('revenue', 'Omzet', (column, index) =>
    f(
      `ROUND(${here(levelRow, column)}*INDEX(${refs.seasonality},${here(calendarMonthRow, column)},1),2)`,
      euros(pnl(index)?.revenue ?? 0),
    ),
  );
  const vatRevenueRow = addRow('vatOnRevenue', 'Btw over de omzet', (column, index) =>
    f(`ROUND(${here(revenueRow, column)}*${refs.vatRevenue},2)`, euros(result.vat.output[index] ?? 0)),
  );
  const revenueInclRow = addRow('revenueInclVat', 'Omzet inclusief btw', (column, index) =>
    f(
      `${here(revenueRow, column)}+${here(vatRevenueRow, column)}`,
      euros((pnl(index)?.revenue ?? 0) + (result.vat.output[index] ?? 0)),
    ),
  );

  // Kosten
  const costOfSalesRow = addRow('costOfSales', 'Inkoopwaarde', (column, index) =>
    f(`ROUND(${here(revenueRow, column)}*${refs.costOfSales},2)`, euros(pnl(index)?.costOfSales ?? 0)),
  );
  const vatCostOfSalesRow = addRow('vatOnCostOfSales', 'Btw over de inkoop', (column) =>
    f(`ROUND(${here(costOfSalesRow, column)}*${refs.vatCostOfSales},2)`),
  );
  const costInclRow = addRow('costOfSalesInclVat', 'Inkoop inclusief btw', (column) =>
    f(`${here(costOfSalesRow, column)}+${here(vatCostOfSalesRow, column)}`),
  );

  const fixedRows = input.assumptions.fixedCosts.map((line) =>
    addRow(
      `fixed:${line.id}`,
      `Vaste kosten: ${line.description === '' ? line.category : line.description}`,
      (column, _index, row) => {
        const amount = `$B$${row}`;
        const growth = here(costFactorRow, column);
        return f(
          line.per === 'maand'
            ? `IF(${here(monthIndexRow, column)}=0,0,ROUND(${amount}*${growth},2))`
            : `IF(${here(positionRow, column)}=0,0,ROUND(${amount}*${growth}*${here(positionRow, column)}/12,2)-ROUND(${amount}*${growth}*(${here(positionRow, column)}-1)/12,2))`,
        );
      },
      { parameter: euros(line.amountCents) },
    ),
  );
  const fixedTotalRow = addRow('fixedTotal', 'Vaste kosten totaal', (column, index) =>
    f(sumCells(fixedRows, column, here), euros(pnl(index)?.fixedCostsTotal ?? 0)),
  );
  const vatFixedRow = addRow('vatOnFixed', 'Btw over de vaste kosten', (column) =>
    f(
      fixedRows.length === 0
        ? '0'
        : fixedRows
            .map(
              (row, lineIndex) =>
                `ROUND(${here(row, column)}*${factor(input.assumptions.fixedCosts[lineIndex]?.vatRateBp ?? 0)},2)`,
            )
            .join('+'),
    ),
  );

  const staffRows = input.assumptions.staff.map((line) =>
    addRow(
      `staff:${line.id}`,
      `Personeel: ${line.description === '' ? 'medewerker' : line.description}`,
      (column, _index, row) => {
        const started = `${here(monthIndexRow, column)}>=${Math.max(1, line.startMonth)}`;
        const notEnded = line.endMonth === null ? 'TRUE' : `${here(monthIndexRow, column)}<=${line.endMonth}`;
        return f(
          `IF(AND(${started},${notEnded}),ROUND($B$${row}*${1 + factor(line.employerCostBp)}*${here(costFactorRow, column)},2),0)`,
        );
      },
      { parameter: euros(line.grossMonthlyCents) },
    ),
  );
  const staffTotalRow = addRow('staffTotal', 'Personeel totaal', (column, index) =>
    f(sumCells(staffRows, column, here), euros(pnl(index)?.staff ?? 0)),
  );

  const oneOffRow = addRow('oneOff', 'Eenmalige kosten', (column, index) =>
    f(
      monthlyItems(
        input.need.oneOffCosts.map((cost) => ({ month: cost.month, amount: euros(cost.amountCents) })),
        here(monthIndexRow, column),
      ),
      euros(pnl(index)?.oneOffCosts ?? 0),
    ),
  );
  const vatOneOffRow = addRow('vatOnOneOff', 'Btw over de eenmalige kosten', (column) =>
    f(
      monthlyItems(
        input.need.oneOffCosts.map((cost) => ({
          month: cost.month,
          amount: euros(Math.round((cost.amountCents * cost.vatRateBp) / 10_000)),
        })),
        here(monthIndexRow, column),
      ),
    ),
  );

  const investmentRow = addRow('investments', 'Investeringen', (column) =>
    f(
      monthlyItems(
        input.need.investments.map((item) => ({ month: item.purchaseMonth, amount: euros(item.amountCents) })),
        here(monthIndexRow, column),
      ),
    ),
  );
  const vatInvestmentRow = addRow('vatOnInvestments', 'Btw over de investeringen', (column) =>
    f(
      monthlyItems(
        input.need.investments.map((item) => ({
          month: item.purchaseMonth,
          amount: euros(Math.round((item.amountCents * item.vatRateBp) / 10_000)),
        })),
        here(monthIndexRow, column),
      ),
    ),
  );

  const depreciationRows = input.need.investments
    .filter((item) => item.category !== 'voorraad' && item.lifeYears !== null && item.lifeYears > 0)
    .map((item) => {
      const life = (item.lifeYears ?? 1) * 12;
      return addRow(
        `dep:${item.id}`,
        `Afschrijving: ${item.description === '' ? 'investering' : item.description}`,
        (column, _index, row) => {
          const amount = `$B$${row}`;
          const elapsed = `${here(monthIndexRow, column)}-${item.purchaseMonth}`;
          return f(
            `ROUND(${amount}*MIN(${life},MAX(0,${elapsed}))/${life},2)-ROUND(${amount}*MIN(${life},MAX(0,${elapsed}-1))/${life},2)`,
          );
        },
        { parameter: euros(Math.max(0, item.amountCents - item.residualValueCents)) },
      );
    });
  const depreciationTotalRow = addRow('depreciationTotal', 'Afschrijving totaal', (column, index) =>
    f(sumCells(depreciationRows, column, here), euros(pnl(index)?.depreciation ?? 0)),
  );

  // Leningen
  const loans = result.loans.map((loan) => {
    const start = loan.rows.find((row) => row.drawdown > 0)?.month ?? 0;
    const isNew = loan.origin === 'nieuw';
    const rate = factor(loan.annualRateBp);
    const grace = graceMonthsOf(input, loan.lineId);
    const term = loan.termMonths;

    const openRow = addRow(`loanOpen:${loan.lineId}`, `Beginstand: ${loan.description}`, (column, index, row) => {
      const previousBalance = before(row + 4, column);
      return previousBalance === null
        ? isNew
          ? 0
          : euros(loan.principal)
        : f(previousBalance, euros(loan.rows[index]?.openingBalance ?? 0));
    });
    const drawRow = addRow(`loanDraw:${loan.lineId}`, `Opname: ${loan.description}`, (column, index) =>
      f(
        isNew ? `IF(${here(monthIndexRow, column)}=${start},${euros(loan.principal)},0)` : '0',
        euros(loan.rows[index]?.drawdown ?? 0),
      ),
    );
    const interestRow = addRow(`loanInterest:${loan.lineId}`, `Rente: ${loan.description}`, (column, index) =>
      f(
        `IF(AND(${here(monthIndexRow, column)}>${start},${here(monthIndexRow, column)}<=${start + term}),ROUND((${here(openRow, column)}+${here(drawRow, column)})*${rate}/12,2),0)`,
        euros(loan.rows[index]?.interest ?? 0),
      ),
    );
    const principalRow = addRow(`loanPrincipal:${loan.lineId}`, `Aflossing: ${loan.description}`, (column, index) => {
      const outstanding = `${here(openRow, column)}+${here(drawRow, column)}`;
      const regular =
        loan.annuityPayment !== null
          ? `MIN(${outstanding},${euros(loan.annuityPayment)}-${here(interestRow, column)})`
          : loan.linearPrincipal !== null
            ? `MIN(${outstanding},${euros(loan.linearPrincipal)})`
            : '0';
      return f(
        `IF(OR(${here(monthIndexRow, column)}<=${start},${here(monthIndexRow, column)}>${start + term}),0,IF(${here(monthIndexRow, column)}=${start + term},${outstanding},IF(${here(monthIndexRow, column)}<=${start + grace},0,${regular})))`,
        euros(loan.rows[index]?.principal ?? 0),
      );
    });
    const balanceRow = addRow(`loanBalance:${loan.lineId}`, `Restschuld: ${loan.description}`, (column, index) =>
      f(
        `${here(openRow, column)}+${here(drawRow, column)}-${here(principalRow, column)}`,
        euros(loan.rows[index]?.closingBalance ?? 0),
      ),
    );

    return { lineId: loan.lineId, description: loan.description, interestRow, principalRow, balanceRow, drawRow };
  });

  const loanInterestRow = addRow('loanInterestTotal', 'Rente leningen', (column, index) =>
    f(
      sumCells(
        loans.map((loan) => loan.interestRow),
        column,
        here,
      ),
      euros(result.loans.reduce((total, loan) => total + (loan.rows[index]?.interest ?? 0), 0)),
    ),
  );
  const loanPrincipalRow = addRow('loanPrincipalTotal', 'Aflossing leningen', (column, index) =>
    f(
      sumCells(
        loans.map((loan) => loan.principalRow),
        column,
        here,
      ),
      euros(pnl(index)?.repayments ?? 0),
    ),
  );
  const loanDrawRow = addRow('loanDrawTotal', 'Opname financiering', (column, index) =>
    f(
      sumCells(
        loans.map((loan) => loan.drawRow),
        column,
        here,
      ),
      euros(cash(index)?.receipts.financing ?? 0),
    ),
  );

  // Krediet: de rente loopt over de roodstand van de vorige maand, dus zonder kringverwijzing.
  const closingCashRow = nextRow + result.creditLines.length * 2 + ROWS_AFTER_CREDITS;
  const credits = result.creditLines.map((credit) => {
    const rate = factor(credit.annualRateBp);
    const drawnRow = addRow(`creditDrawn:${credit.lineId}`, `Opgenomen krediet: ${credit.description}`, (column, index) =>
      f(`MIN(${euros(credit.limit)},MAX(0,-${here(closingCashRow, column)}))`, euros(credit.drawn[index] ?? 0)),
    );
    const interestRow = addRow(
      `creditInterest:${credit.lineId}`,
      `Kredietrente: ${credit.description}`,
      (column, index) => {
        const previous = before(drawnRow, column);
        return f(previous === null ? '0' : `ROUND(${previous}*${rate}/12,2)`, euros(credit.interest[index] ?? 0));
      },
    );
    return { lineId: credit.lineId, description: credit.description, interestRow, drawnRow };
  });

  const interestTotalRow = addRow('interestTotal', 'Rente totaal', (column, index) =>
    f(
      sumCells([loanInterestRow, ...credits.map((credit) => credit.interestRow)], column, here),
      euros(pnl(index)?.interest ?? 0),
    ),
  );

  addRow(
    'ebit',
    'Bedrijfsresultaat',
    (column, index) =>
      f(
        `${here(revenueRow, column)}-${here(costOfSalesRow, column)}-${here(fixedTotalRow, column)}-${here(staffTotalRow, column)}-${here(oneOffRow, column)}-${here(depreciationTotalRow, column)}`,
        euros(pnl(index)?.ebit ?? 0),
      ),
    { bold: true },
  );

  // Btw per aangifteperiode
  const vatBalanceRow = addRow('vatBalance', 'Btw-saldo van de maand', (column, index) =>
    f(
      `${here(vatRevenueRow, column)}-${here(vatCostOfSalesRow, column)}-${here(vatFixedRow, column)}-${here(vatOneOffRow, column)}-${here(vatInvestmentRow, column)}`,
      euros((result.vat.output[index] ?? 0) - (result.vat.input[index] ?? 0)),
    ),
  );
  const vatSettlementRow = addRow('vatSettlement', 'Btw-verrekening', (column, index) => {
    const previousPeriod = before(vatPeriodRow, column);
    return f(
      previousPeriod === null
        ? '0'
        : `IF(${previousPeriod}=${here(vatPeriodRow, column)},0,SUMIF(${rowRange(vatPeriodRow)},${previousPeriod},${rowRange(vatBalanceRow)}))`,
      euros((result.vat.payments[index] ?? 0) - (result.vat.refunds[index] ?? 0)),
    );
  });
  const vatPaidRow = addRow('vatPaid', 'Btw betalen', (column, index) =>
    f(`MAX(0,${here(vatSettlementRow, column)})`, euros(result.vat.payments[index] ?? 0)),
  );
  const vatRefundRow = addRow('vatRefund', 'Btw terugkrijgen', (column, index) =>
    f(`MAX(0,-${here(vatSettlementRow, column)})`, euros(result.vat.refunds[index] ?? 0)),
  );

  // Ontvangsten en betalingen
  const customersRow = addRow('customers', 'Ontvangen van klanten', (column, index) =>
    f(
      `${shiftFormula(here(monthIndexRow, column), rowRange(revenueInclRow), refs.debtorWholeMonths, refs.debtorShare)}+IF(${here(monthIndexRow, column)}=1,${refs.openingReceivables},0)`,
      euros(cash(index)?.receipts.customers ?? 0),
    ),
  );
  const payCostOfSalesRow = addRow('payCostOfSales', 'Betaald aan leveranciers', (column, index) =>
    f(
      `${shiftFormula(here(monthIndexRow, column), rowRange(costInclRow), refs.creditorWholeMonths, refs.creditorShare)}+IF(${here(monthIndexRow, column)}=1,${refs.openingPayables},0)`,
      euros(cash(index)?.payments.operations.costOfSales ?? 0),
    ),
  );
  const ownContributionRow = addRow('ownContribution', 'Eigen inbreng', (column, index) =>
    f(
      `IF(${here(monthIndexRow, column)}=0,${euros(input.need.ownContributionCents)},0)`,
      euros(cash(index)?.receipts.ownContribution ?? 0),
    ),
  );
  const grantsRow = addRow('grants', 'Subsidies en schenkingen', (column, index) =>
    f(
      monthlyItems(
        input.need.grants.map((grant) => ({ month: grant.month, amount: euros(grant.amountCents) })),
        here(monthIndexRow, column),
      ),
      euros(cash(index)?.receipts.grants ?? 0),
    ),
  );
  const withdrawalsRow = addRow('withdrawals', 'Privé-opnamen', (column, index) =>
    f(
      isBv ? '0' : `IF(${here(monthIndexRow, column)}=0,0,${refs.withdrawals})`,
      euros(pnl(index)?.privateWithdrawals ?? 0),
    ),
  );
  const taxRow = addRow(
    'corporateTax',
    'Vennootschapsbelasting',
    (_column, index) => euros(cash(index)?.payments.corporateTax ?? 0),
    { parameter: 'uit de rekenkern' },
  );
  const dividendRow = addRow('dividend', 'Dividend', (_column, index) => euros(cash(index)?.payments.dividend ?? 0), {
    parameter: 'uit de rekenkern',
  });

  const receiptsRow = addRow(
    'receiptsTotal',
    'Ontvangsten',
    (column, index) =>
      f(
        sumCells([customersRow, loanDrawRow, ownContributionRow, grantsRow, vatRefundRow], column, here),
        euros(cash(index)?.receipts.total ?? 0),
      ),
    { bold: true },
  );
  const paymentsRow = addRow(
    'paymentsTotal',
    'Uitgaven',
    (column, index) =>
      f(
        sumCells(
          [
            payCostOfSalesRow,
            fixedTotalRow,
            vatFixedRow,
            staffTotalRow,
            oneOffRow,
            vatOneOffRow,
            vatPaidRow,
            investmentRow,
            vatInvestmentRow,
            interestTotalRow,
            loanPrincipalRow,
            withdrawalsRow,
            taxRow,
            dividendRow,
          ],
          column,
          here,
        ),
        euros(cash(index)?.payments.total ?? 0),
      ),
    { bold: true },
  );
  const openingCashRow = addRow('openingCash', 'Beginsaldo', (column, index) => {
    const previousClosing = before(closingCashRow, column);
    return f(previousClosing ?? refs.openingCash, euros(cash(index)?.openingCash ?? 0));
  });
  const writtenClosingRow = addRow(
    'closingCash',
    'Eindsaldo',
    (column, index) =>
      f(
        `${here(openingCashRow, column)}+${here(receiptsRow, column)}-${here(paymentsRow, column)}`,
        euros(cash(index)?.closingCash ?? 0),
      ),
    { bold: true },
  );

  if (writtenClosingRow !== closingCashRow) {
    throw new Error(`Het eindsaldo staat op rij ${writtenClosingRow}, maar er werd naar rij ${closingCashRow} verwezen.`);
  }

  sheet.getColumn(1).width = 38;
  sheet.getColumn(2).width = 16;
  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];

  return { sheetName: sheet.name, firstColumn, lastColumn, rows, loans, credits };
}

function growthFormula(periodCell: string, growth: readonly [string, string]): string {
  return `IF(${periodCell}="y2",1+${growth[0]},IF(${periodCell}="y3",(1+${growth[0]})*(1+${growth[1]}),1))`;
}

function sumCells(rowNumbers: readonly number[], column: number, at: (row: number, column: number) => string): string {
  return rowNumbers.length === 0 ? '0' : rowNumbers.map((row) => at(row, column)).join('+');
}

/** Bedragen die in één bepaalde maand vallen, als som van IF's. */
function monthlyItems(items: readonly { month: number; amount: number }[], monthCell: string): string {
  if (items.length === 0) return '0';
  return items.map((item) => `IF(${monthCell}=${item.month},${item.amount},0)`).join('+');
}

/**
 * Betaaltermijn: bij 45 dagen komt de helft één maand later binnen en de rest twee maanden later.
 * De reeks begint bij maand 0, dus kolom (maand + 1) binnen het bereik.
 */
function shiftFormula(monthCell: string, sourceRange: string, wholeMonths: string, share: string): string {
  const source = `${monthCell}-${wholeMonths}`;
  const early = `IF(${source}>=0,INDEX(${sourceRange},1,${source}+1)-ROUND(INDEX(${sourceRange},1,${source}+1)*${share},2),0)`;
  const late = `IF(${source}-1>=0,ROUND(INDEX(${sourceRange},1,${source})*${share},2),0)`;
  return `${early}+${late}`;
}

function positionInPeriod(result: PlanResult, index: number): number {
  const meta = result.meta.months[index];
  if (meta === undefined || meta.index === 0) return 0;
  const period = result.meta.periods.find((candidate) => candidate.key === meta.period);
  return period === undefined ? 0 : meta.index - period.firstMonth + 1;
}

function vatPeriodKey(result: PlanResult, index: number, input: PlanInput): number {
  const meta = result.meta.months[index];
  if (meta === undefined) return 0;
  // Het startmoment hoort bij de aangifte van de eerste prognosemaand.
  const reference = meta.index === 0 ? result.meta.months[1] : meta;
  if (reference === undefined) return 0;
  return input.assumptions.vat.filing === 'maand'
    ? reference.year * 12 + reference.month
    : reference.year * 4 + reference.quarter;
}

function growthValue(result: PlanResult, index: number, growthY2: number, growthY3: number): number {
  const period = result.meta.months[index]?.period;
  if (period === 'y2') return 1 + growthY2;
  if (period === 'y3') return (1 + growthY2) * (1 + growthY3);
  return 1;
}

function revenueLevelValue(input: PlanInput, result: PlanResult, index: number): number {
  const meta = result.meta.months[index];
  if (meta === undefined || meta.index === 0) return 0;
  const model = input.assumptions.revenue;
  const base =
    model.kind === 'uurtarief'
      ? model.hourlyRateCents * model.billableHoursPerMonth
      : model.kind === 'opdrachten'
        ? model.jobsPerMonth * model.averageJobValueCents
        : model.monthlyAmountCents;
  const monthlyGrowth = model.kind === 'maandbedrag' ? 1 + factor(model.monthlyGrowthBp) : 1;
  const rampUp = monthlyGrowth ** (Math.min(meta.index, 12) - 1);
  const yearly = growthValue(
    result,
    index,
    factor(input.assumptions.revenueGrowthBp.y2),
    factor(input.assumptions.revenueGrowthBp.y3),
  );
  return euros(base) * rampUp * yearly;
}

function graceMonthsOf(input: PlanInput, lineId: string): number {
  const line = input.financing.lines.find((candidate) => candidate.id === lineId);
  return line !== undefined && line.kind !== 'krediet' ? line.graceMonths : 0;
}
