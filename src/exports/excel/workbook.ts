import ExcelJS from 'exceljs';
import { DISCLAIMER } from '../../config';
import { PERIOD_LABELS, RATIO_DISCLAIMER } from '../../config/texts';
import type { PlanInput, PlanResult } from '../../engine';
import { absolute, cell, euros, factor, range } from './cells';
import { MONEY_FORMAT, writeMonthsSheet, type AssumptionRefs, type MonthGrid } from './monthsSheet';

const PERCENT_FORMAT = '0.0%';
const FIRST_MONTH_COLUMN = 3;

/**
 * Een werkend model, geen plaatje: op Maanden staat de hele prognose in formules die naar
 * Aannames wijzen, en de overzichtsbladen tellen die maanden op. Wie een aanname aanpast,
 * ziet alles meebewegen.
 */
export function buildWorkbook(input: PlanInput, result: PlanResult): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LOFI';
  workbook.company = input.company.name;

  const assumptions = workbook.addWorksheet('Aannames');
  const months = workbook.addWorksheet('Maanden');
  const investments = workbook.addWorksheet('Investeringen');
  const operations = workbook.addWorksheet('Exploitatie');
  const liquidity = workbook.addWorksheet('Liquiditeit');
  const financing = workbook.addWorksheet('Financiering');
  const ratios = workbook.addWorksheet("Ratio's");

  const refs = writeAssumptions(assumptions, input, result);
  const grid = writeMonthsSheet(months, input, result, refs, FIRST_MONTH_COLUMN);

  writeInvestments(investments, input, result, grid);
  writeOperations(operations, input, result, grid);
  writeLiquidity(liquidity, result, grid);
  writeFinancing(financing, result, grid);
  writeRatios(ratios, input, result, grid);

  return workbook;
}

function writeAssumptions(sheet: ExcelJS.Worksheet, input: PlanInput, result: PlanResult): AssumptionRefs {
  const { assumptions } = input;
  let row = 0;

  const title = (text: string) => {
    row += row === 0 ? 1 : 2;
    const target = sheet.getRow(row);
    target.getCell(1).value = text;
    target.getCell(1).font = { bold: true, size: 12 };
  };

  const put = (label: string, value: number | string, note?: string, format?: string): string => {
    row += 1;
    const target = sheet.getRow(row);
    target.getCell(1).value = label;
    target.getCell(2).value = value;
    if (format !== undefined) target.getCell(2).numFmt = format;
    if (note !== undefined) target.getCell(3).value = note;
    return `Aannames!${absolute(2, row)}`;
  };

  title('Aannames');
  sheet.getRow(row).getCell(3).value = DISCLAIMER;
  put('Onderneming', input.company.name);
  put('Rechtsvorm', input.company.legalForm);
  put('Eerste prognosemaand', assumptions.startMonth);
  put('Aantal prognosemaanden', result.meta.horizonMonths, undefined, '0');

  title('Omzet');
  const revenueBase = put('Omzetbasis per maand', euros(baseRevenueCents(input)), 'vóór seizoen en groei', MONEY_FORMAT);
  const monthlyGrowth = put(
    'Groei per maand in de aanloop',
    assumptions.revenue.kind === 'maandbedrag' ? factor(assumptions.revenue.monthlyGrowthBp) : 0,
    'alleen bij een vast maandbedrag',
    PERCENT_FORMAT,
  );
  const rampUpMonths = put('Aanloop duurt (maanden)', 12, undefined, '0');
  const growthY2 = put('Omzetgroei jaar 2', factor(assumptions.revenueGrowthBp.y2), undefined, PERCENT_FORMAT);
  const growthY3 = put('Omzetgroei jaar 3', factor(assumptions.revenueGrowthBp.y3), undefined, PERCENT_FORMAT);
  const costGrowthY2 = put('Kostenstijging jaar 2', factor(assumptions.costGrowthBp.y2), undefined, PERCENT_FORMAT);
  const costGrowthY3 = put('Kostenstijging jaar 3', factor(assumptions.costGrowthBp.y3), undefined, PERCENT_FORMAT);

  title('Seizoenspatroon');
  sheet.getRow(row).getCell(3).value = '1,00 is een gemiddelde maand; samen 12,00';
  const seasonalityFirst = row + 1;
  const monthNames = [
    'januari',
    'februari',
    'maart',
    'april',
    'mei',
    'juni',
    'juli',
    'augustus',
    'september',
    'oktober',
    'november',
    'december',
  ];
  assumptions.seasonality.forEach((weight, index) => {
    put(monthNames[index] ?? `maand ${index + 1}`, weight / 100, undefined, '0.00');
  });

  title('Kosten en btw');
  const costOfSales = put('Inkoopwaarde van de omzet', factor(assumptions.costOfSalesBp), undefined, PERCENT_FORMAT);
  const vatRevenue = put('Btw op de omzet', effectiveVatRate(input), undefined, PERCENT_FORMAT);
  const vatCostOfSales = put('Btw op de inkoop', factor(assumptions.costOfSalesVatRateBp), undefined, PERCENT_FORMAT);
  const withdrawals = put(
    'Privé-opname per maand',
    euros(input.company.legalForm === 'bv' ? 0 : assumptions.privateWithdrawalsMonthlyCents),
    'inclusief reservering inkomstenbelasting',
    MONEY_FORMAT,
  );

  title('Betaaltermijnen');
  sheet.getRow(row).getCell(3).value = 'Gerekend met maanden van 30 dagen';
  const debtorWhole = put('Debiteuren: hele maanden later', Math.floor(assumptions.debtorDays / 30), undefined, '0');
  const debtorShare = put(
    'Debiteuren: deel nog een maand later',
    (assumptions.debtorDays % 30) / 30,
    `${assumptions.debtorDays} dagen`,
    PERCENT_FORMAT,
  );
  const creditorWhole = put('Crediteuren: hele maanden later', Math.floor(assumptions.creditorDays / 30), undefined, '0');
  const creditorShare = put(
    'Crediteuren: deel nog een maand later',
    (assumptions.creditorDays % 30) / 30,
    `${assumptions.creditorDays} dagen`,
    PERCENT_FORMAT,
  );

  title('Startpositie');
  const openingCash = put('Banksaldo bij de start', euros(result.balanceSheet.opening.cash), undefined, MONEY_FORMAT);
  const openingReceivables = put(
    'Openstaande debiteuren',
    euros(result.balanceSheet.opening.receivables),
    'komen binnen in de eerste prognosemaand',
    MONEY_FORMAT,
  );
  const openingPayables = put(
    'Openstaande crediteuren',
    euros(result.balanceSheet.opening.payables),
    'worden betaald in de eerste prognosemaand',
    MONEY_FORMAT,
  );

  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 52;

  return {
    revenueBase,
    monthlyGrowth,
    rampUpMonths,
    revenueGrowth: [growthY2, growthY3],
    costGrowth: [costGrowthY2, costGrowthY3],
    seasonality: range(2, seasonalityFirst, 2, seasonalityFirst + 11, 'Aannames'),
    costOfSales,
    vatRevenue,
    vatCostOfSales,
    debtorWholeMonths: debtorWhole,
    debtorShare,
    creditorWholeMonths: creditorWhole,
    creditorShare,
    withdrawals,
    openingCash,
    openingReceivables,
    openingPayables,
  };
}

function baseRevenueCents(input: PlanInput): number {
  const model = input.assumptions.revenue;
  switch (model.kind) {
    case 'uurtarief':
      return model.hourlyRateCents * model.billableHoursPerMonth;
    case 'opdrachten':
      return model.jobsPerMonth * model.averageJobValueCents;
    case 'maandbedrag':
      return model.monthlyAmountCents;
  }
}

function effectiveVatRate(input: PlanInput): number {
  return (
    input.assumptions.vat.revenueRates.reduce((total, rate) => total + (rate.rateBp * rate.shareBp) / 10_000, 0) /
    10_000
  );
}

// Hulpmiddelen voor de overzichtsbladen

interface GridHelper {
  /** Optelling van een maandrij over één boekjaar. */
  sumPeriod: (rowKey: string, periodKey: string) => string;
  /** Verwijzing naar één maand van een maandrij. */
  month: (rowKey: string, monthIndex: number) => string;
  row: (rowKey: string) => number;
  monthRange: (rowKey: string) => string;
}

function helper(grid: MonthGrid): GridHelper {
  const row = (rowKey: string): number => {
    const found = grid.rows[rowKey];
    if (found === undefined) throw new Error(`Onbekende rij op het blad Maanden: ${rowKey}`);
    return found;
  };
  const monthRange = (rowKey: string) =>
    range(grid.firstColumn, row(rowKey), grid.lastColumn, row(rowKey), grid.sheetName);
  return {
    row,
    monthRange,
    sumPeriod: (rowKey, periodKey) =>
      `SUMIF(${range(grid.firstColumn, row('period'), grid.lastColumn, row('period'), grid.sheetName)},"${periodKey}",${monthRange(rowKey)})`,
    month: (rowKey, monthIndex) => `'${grid.sheetName}'!${cell(grid.firstColumn + monthIndex, row(rowKey))}`,
  };
}

function sheetTitle(sheet: ExcelJS.Worksheet, title: string, subtitle?: string): void {
  sheet.getRow(1).getCell(1).value = title;
  sheet.getRow(1).getCell(1).font = { bold: true, size: 12 };
  if (subtitle !== undefined) sheet.getRow(2).getCell(1).value = subtitle;
  sheet.getColumn(1).width = 34;
}

function writeInvestments(
  sheet: ExcelJS.Worksheet,
  input: PlanInput,
  result: PlanResult,
  grid: MonthGrid,
): void {
  const grid$ = helper(grid);
  sheetTitle(sheet, 'Investeringen', 'Bedragen exclusief btw; de btw staat apart.');

  const header = sheet.getRow(4);
  ['Omschrijving', 'Soort', 'Bedrag', 'Btw-tarief', 'Btw', 'Afschrijving in jaren', 'Restwaarde', 'Aanschafmaand'].forEach(
    (label, index) => {
      const target = header.getCell(index + 1);
      target.value = label;
      target.font = { bold: true };
    },
  );

  input.need.investments.forEach((item, index) => {
    const row = sheet.getRow(5 + index);
    row.getCell(1).value = item.description;
    row.getCell(2).value = item.category;
    row.getCell(3).value = euros(item.amountCents);
    row.getCell(3).numFmt = MONEY_FORMAT;
    row.getCell(4).value = factor(item.vatRateBp);
    row.getCell(4).numFmt = PERCENT_FORMAT;
    row.getCell(5).value = { formula: `ROUND(C${5 + index}*D${5 + index},2)`, result: euros(Math.round((item.amountCents * item.vatRateBp) / 10_000)) };
    row.getCell(5).numFmt = MONEY_FORMAT;
    row.getCell(6).value = item.lifeYears ?? 0;
    row.getCell(7).value = euros(item.residualValueCents);
    row.getCell(7).numFmt = MONEY_FORMAT;
    row.getCell(8).value = item.purchaseMonth;
  });

  const totalRow = sheet.getRow(5 + input.need.investments.length);
  totalRow.getCell(1).value = 'Totaal';
  totalRow.getCell(1).font = { bold: true };
  if (input.need.investments.length > 0) {
    totalRow.getCell(3).value = { formula: `SUM(C5:C${4 + input.need.investments.length})`, result: euros(result.financingNeed.uses.investments) };
    totalRow.getCell(5).value = { formula: `SUM(E5:E${4 + input.need.investments.length})`, result: euros(result.financingNeed.vatOnInvestments.total) };
  }
  totalRow.getCell(3).numFmt = MONEY_FORMAT;
  totalRow.getCell(5).numFmt = MONEY_FORMAT;

  const depreciationRow = sheet.getRow(7 + input.need.investments.length);
  depreciationRow.getCell(1).value = 'Afschrijving per boekjaar';
  depreciationRow.getCell(1).font = { bold: true };
  result.meta.periods.forEach((period, index) => {
    const labelCell = sheet.getRow(8 + input.need.investments.length).getCell(index + 2);
    labelCell.value = PERIOD_LABELS[period.key] ?? period.key;
    const valueCell = sheet.getRow(9 + input.need.investments.length).getCell(index + 2);
    valueCell.value = {
      formula: grid$.sumPeriod('depreciationTotal', period.key),
      result: euros(result.pnl.periods[index]?.depreciation ?? 0),
    };
    valueCell.numFmt = MONEY_FORMAT;
  });

  sheet.getColumn(1).width = 30;
  for (const column of [3, 5, 7]) sheet.getColumn(column).width = 14;
}

function writeOperations(sheet: ExcelJS.Worksheet, input: PlanInput, result: PlanResult, grid: MonthGrid): void {
  const grid$ = helper(grid);
  sheetTitle(sheet, 'Exploitatiebegroting', 'Opgeteld uit het blad Maanden; bedragen exclusief btw.');
  const isBv = input.company.legalForm === 'bv';

  const lines: { label: string; rowKey?: string; formula?: (periodKey: string) => string; bold?: boolean; value: (index: number) => number }[] = [
    { label: 'Omzet', rowKey: 'revenue', value: (index) => result.pnl.periods[index]?.revenue ?? 0 },
    { label: 'Inkoopwaarde', rowKey: 'costOfSales', value: (index) => result.pnl.periods[index]?.costOfSales ?? 0 },
    {
      label: 'Brutomarge',
      formula: (periodKey) => `${grid$.sumPeriod('revenue', periodKey)}-${grid$.sumPeriod('costOfSales', periodKey)}`,
      bold: true,
      value: (index) => result.pnl.periods[index]?.grossMargin ?? 0,
    },
    { label: 'Vaste kosten', rowKey: 'fixedTotal', value: (index) => result.pnl.periods[index]?.fixedCostsTotal ?? 0 },
    { label: 'Personeel', rowKey: 'staffTotal', value: (index) => result.pnl.periods[index]?.staff ?? 0 },
    { label: 'Eenmalige kosten', rowKey: 'oneOff', value: (index) => result.pnl.periods[index]?.oneOffCosts ?? 0 },
    { label: 'Afschrijving', rowKey: 'depreciationTotal', value: (index) => result.pnl.periods[index]?.depreciation ?? 0 },
    { label: 'Bedrijfsresultaat', rowKey: 'ebit', bold: true, value: (index) => result.pnl.periods[index]?.ebit ?? 0 },
    { label: 'Rente', rowKey: 'interestTotal', value: (index) => result.pnl.periods[index]?.interest ?? 0 },
    {
      label: 'Resultaat voor belasting',
      formula: (periodKey) => `${grid$.sumPeriod('ebit', periodKey)}-${grid$.sumPeriod('interestTotal', periodKey)}`,
      bold: true,
      value: (index) => result.pnl.periods[index]?.resultBeforeTax ?? 0,
    },
    ...(isBv
      ? [
          {
            label: 'Vennootschapsbelasting',
            rowKey: 'corporateTax',
            value: (index: number) => result.pnl.periods[index]?.corporateTax ?? 0,
          },
          { label: 'Dividend', rowKey: 'dividend', value: (index: number) => result.pnl.periods[index]?.dividend ?? 0 },
        ]
      : [
          {
            label: 'Privé-opnamen',
            rowKey: 'withdrawals',
            value: (index: number) => result.pnl.periods[index]?.privateWithdrawals ?? 0,
          },
        ]),
    {
      label: 'Kasstroom voor rente en aflossing',
      formula: (periodKey) =>
        isBv
          ? `${grid$.sumPeriod('ebit', periodKey)}+${grid$.sumPeriod('depreciationTotal', periodKey)}-${grid$.sumPeriod('corporateTax', periodKey)}-${grid$.sumPeriod('dividend', periodKey)}`
          : `${grid$.sumPeriod('ebit', periodKey)}+${grid$.sumPeriod('depreciationTotal', periodKey)}-${grid$.sumPeriod('withdrawals', periodKey)}`,
      bold: true,
      value: (index) => result.pnl.periods[index]?.cfads ?? 0,
    },
    {
      label: 'Rente en aflossing',
      formula: (periodKey) =>
        `${grid$.sumPeriod('interestTotal', periodKey)}+${grid$.sumPeriod('loanPrincipalTotal', periodKey)}`,
      value: (index) => result.pnl.periods[index]?.debtService ?? 0,
    },
  ];

  const headerRow = sheet.getRow(4);
  headerRow.getCell(1).value = 'Post';
  headerRow.getCell(1).font = { bold: true };
  result.meta.periods.forEach((period, index) => {
    const target = headerRow.getCell(index + 2);
    target.value = `${PERIOD_LABELS[period.key] ?? period.key} (${period.calendarYear})`;
    target.font = { bold: true };
  });

  lines.forEach((line, lineIndex) => {
    const row = sheet.getRow(5 + lineIndex);
    row.getCell(1).value = line.label;
    if (line.bold === true) row.getCell(1).font = { bold: true };
    result.meta.periods.forEach((period, index) => {
      const target = row.getCell(index + 2);
      const text = line.formula === undefined ? grid$.sumPeriod(line.rowKey ?? '', period.key) : line.formula(period.key);
      target.value = { formula: text, result: euros(line.value(index)) };
      target.numFmt = MONEY_FORMAT;
      if (line.bold === true) target.font = { bold: true };
    });
  });

  for (let column = 2; column <= result.meta.periods.length + 1; column += 1) sheet.getColumn(column).width = 16;
}

function writeLiquidity(sheet: ExcelJS.Worksheet, result: PlanResult, grid: MonthGrid): void {
  const grid$ = helper(grid);
  sheetTitle(sheet, 'Liquiditeitsbegroting', 'Per maand, inclusief btw. Verwijst naar het blad Maanden.');

  const lines: { label: string; rowKey: string; bold?: boolean }[] = [
    { label: 'Beginsaldo', rowKey: 'openingCash' },
    { label: 'Ontvangen van klanten', rowKey: 'customers' },
    { label: 'Opname financiering', rowKey: 'loanDrawTotal' },
    { label: 'Eigen inbreng', rowKey: 'ownContribution' },
    { label: 'Subsidies', rowKey: 'grants' },
    { label: 'Btw terugkrijgen', rowKey: 'vatRefund' },
    { label: 'Ontvangsten', rowKey: 'receiptsTotal', bold: true },
    { label: 'Betaald aan leveranciers', rowKey: 'payCostOfSales' },
    { label: 'Vaste kosten', rowKey: 'fixedTotal' },
    { label: 'Btw over de vaste kosten', rowKey: 'vatOnFixed' },
    { label: 'Personeel', rowKey: 'staffTotal' },
    { label: 'Investeringen', rowKey: 'investments' },
    { label: 'Btw over de investeringen', rowKey: 'vatOnInvestments' },
    { label: 'Btw betalen', rowKey: 'vatPaid' },
    { label: 'Rente', rowKey: 'interestTotal' },
    { label: 'Aflossing', rowKey: 'loanPrincipalTotal' },
    { label: 'Privé-opnamen', rowKey: 'withdrawals' },
    { label: 'Vennootschapsbelasting', rowKey: 'corporateTax' },
    { label: 'Dividend', rowKey: 'dividend' },
    { label: 'Uitgaven', rowKey: 'paymentsTotal', bold: true },
    { label: 'Eindsaldo', rowKey: 'closingCash', bold: true },
  ];

  const headerRow = sheet.getRow(4);
  headerRow.getCell(1).value = 'Kasstroom';
  headerRow.getCell(1).font = { bold: true };
  result.meta.months.forEach((meta, index) => {
    const target = headerRow.getCell(index + 2);
    target.value = meta.index === 0 ? 'start' : `${meta.year}-${String(meta.month).padStart(2, '0')}`;
    target.font = { bold: true };
  });

  lines.forEach((line, lineIndex) => {
    const row = sheet.getRow(5 + lineIndex);
    row.getCell(1).value = line.label;
    if (line.bold === true) row.getCell(1).font = { bold: true };
    result.meta.months.forEach((meta, index) => {
      const target = row.getCell(index + 2);
      target.value = { formula: grid$.month(line.rowKey, meta.index) };
      target.numFmt = MONEY_FORMAT;
      if (line.bold === true) target.font = { bold: true };
    });
  });

  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];
}

function writeFinancing(sheet: ExcelJS.Worksheet, result: PlanResult, grid: MonthGrid): void {
  const grid$ = helper(grid);
  sheetTitle(sheet, 'Financiering', 'Rente, aflossing en restschuld per boekjaar.');
  let row = 4;

  for (const loan of result.loans) {
    const schedule = grid.loans.find((candidate) => candidate.lineId === loan.lineId);
    if (schedule === undefined) continue;

    const titleRow = sheet.getRow(row);
    titleRow.getCell(1).value = loan.description === '' ? loan.kind : loan.description;
    titleRow.getCell(1).font = { bold: true };
    titleRow.getCell(2).value = euros(loan.principal);
    titleRow.getCell(2).numFmt = MONEY_FORMAT;
    titleRow.getCell(3).value = factor(loan.annualRateBp);
    titleRow.getCell(3).numFmt = PERCENT_FORMAT;
    titleRow.getCell(4).value = `${loan.termMonths} maanden`;
    if (loan.annuityPayment !== null) {
      titleRow.getCell(5).value = euros(loan.annuityPayment);
      titleRow.getCell(5).numFmt = MONEY_FORMAT;
      titleRow.getCell(6).value = 'termijn per maand';
    }
    row += 1;

    const periodRow = sheet.getRow(row);
    periodRow.getCell(1).value = 'Post';
    result.meta.periods.forEach((period, index) => {
      periodRow.getCell(index + 2).value = PERIOD_LABELS[period.key] ?? period.key;
    });
    row += 1;

    const entries: { label: string; rowKey: string; value: (index: number) => number }[] = [
      { label: 'Rente', rowKey: `loanInterest:${loan.lineId}`, value: (index) => loan.periods[index]?.interest ?? 0 },
      { label: 'Aflossing', rowKey: `loanPrincipal:${loan.lineId}`, value: (index) => loan.periods[index]?.principal ?? 0 },
    ];
    for (const entry of entries) {
      const target = sheet.getRow(row);
      target.getCell(1).value = entry.label;
      result.meta.periods.forEach((period, index) => {
        const valueCell = target.getCell(index + 2);
        valueCell.value = { formula: grid$.sumPeriod(entry.rowKey, period.key), result: euros(entry.value(index)) };
        valueCell.numFmt = MONEY_FORMAT;
      });
      row += 1;
    }

    const balanceRow = sheet.getRow(row);
    balanceRow.getCell(1).value = 'Restschuld per 31-12';
    result.meta.periods.forEach((period, index) => {
      const valueCell = balanceRow.getCell(index + 2);
      valueCell.value = {
        formula: grid$.month(`loanBalance:${loan.lineId}`, period.lastMonth),
        result: euros(loan.periods[index]?.closingBalance ?? 0),
      };
      valueCell.numFmt = MONEY_FORMAT;
    });
    row += 2;
  }

  for (const credit of result.creditLines) {
    const titleRow = sheet.getRow(row);
    titleRow.getCell(1).value = credit.description === '' ? 'Rekening-courantkrediet' : credit.description;
    titleRow.getCell(1).font = { bold: true };
    titleRow.getCell(2).value = euros(credit.limit);
    titleRow.getCell(2).numFmt = MONEY_FORMAT;
    titleRow.getCell(3).value = factor(credit.annualRateBp);
    titleRow.getCell(3).numFmt = PERCENT_FORMAT;
    titleRow.getCell(4).value = 'limiet en rente';
    row += 1;

    const interestRow = sheet.getRow(row);
    interestRow.getCell(1).value = 'Kredietrente';
    result.meta.periods.forEach((period, index) => {
      const valueCell = interestRow.getCell(index + 2);
      valueCell.value = {
        formula: grid$.sumPeriod(`creditInterest:${credit.lineId}`, period.key),
        result: euros(credit.periods[index]?.interest ?? 0),
      };
      valueCell.numFmt = MONEY_FORMAT;
    });
    row += 2;
  }

  sheet.getColumn(1).width = 30;
  for (let column = 2; column <= 7; column += 1) sheet.getColumn(column).width = 16;
}

function writeRatios(sheet: ExcelJS.Worksheet, input: PlanInput, result: PlanResult, grid: MonthGrid): void {
  const grid$ = helper(grid);
  sheetTitle(sheet, "Ratio's", RATIO_DISCLAIMER);

  const headerRow = sheet.getRow(4);
  headerRow.getCell(1).value = 'Ratio';
  headerRow.getCell(1).font = { bold: true };
  result.meta.periods.forEach((period, index) => {
    const target = headerRow.getCell(index + 2);
    target.value = PERIOD_LABELS[period.key] ?? period.key;
    target.font = { bold: true };
  });

  const isBv = input.company.legalForm === 'bv';
  const cfads = (periodKey: string) =>
    isBv
      ? `${grid$.sumPeriod('ebit', periodKey)}+${grid$.sumPeriod('depreciationTotal', periodKey)}-${grid$.sumPeriod('corporateTax', periodKey)}-${grid$.sumPeriod('dividend', periodKey)}`
      : `${grid$.sumPeriod('ebit', periodKey)}+${grid$.sumPeriod('depreciationTotal', periodKey)}-${grid$.sumPeriod('withdrawals', periodKey)}`;
  const debtService = (periodKey: string) =>
    `${grid$.sumPeriod('interestTotal', periodKey)}+${grid$.sumPeriod('loanPrincipalTotal', periodKey)}`;

  const dscrRow = sheet.getRow(5);
  dscrRow.getCell(1).value = 'DSCR';
  result.meta.periods.forEach((period, index) => {
    const target = dscrRow.getCell(index + 2);
    const value = result.ratios.dscr[index]?.value;
    target.value = {
      formula: `IF((${debtService(period.key)})=0,"",(${cfads(period.key)})/(${debtService(period.key)}))`,
      ...(value === null || value === undefined ? {} : { result: value }),
    };
    target.numFmt = '0.00';
  });

  const breakEvenRow = sheet.getRow(6);
  breakEvenRow.getCell(1).value = 'Break-evenomzet';
  result.meta.periods.forEach((period, index) => {
    const target = breakEvenRow.getCell(index + 2);
    const fixedBase = `${grid$.sumPeriod('fixedTotal', period.key)}+${grid$.sumPeriod('staffTotal', period.key)}+${grid$.sumPeriod('depreciationTotal', period.key)}+${grid$.sumPeriod('interestTotal', period.key)}`;
    const margin = `(${grid$.sumPeriod('revenue', period.key)}-${grid$.sumPeriod('costOfSales', period.key)})`;
    const revenue = grid$.sumPeriod('revenue', period.key);
    const value = result.ratios.breakEven[index]?.revenue;
    target.value = {
      formula: `IF(${margin}<=0,"",ROUND((${fixedBase})*${revenue}/${margin},2))`,
      ...(value === null || value === undefined ? {} : { result: euros(value) }),
    };
    target.numFmt = MONEY_FORMAT;
  });

  const lowestRow = sheet.getRow(8);
  lowestRow.getCell(1).value = 'Laagste kassaldo';
  lowestRow.getCell(2).value = {
    formula: `MIN(${grid$.monthRange('closingCash')})`,
    result: euros(result.ratios.lowestCash.amount),
  };
  lowestRow.getCell(2).numFmt = MONEY_FORMAT;

  const debtRow = sheet.getRow(9);
  debtRow.getCell(1).value = 'Schuld ten opzichte van de kasstroom (jaren)';
  const firstFullYear = result.meta.periods.find((period) => period.key === 'y1');
  if (firstFullYear !== undefined) {
    const value = result.ratios.debtToCashflow.value;
    debtRow.getCell(2).value = {
      formula: `IF((${cfads('y1')})<=0,"",${euros(result.ratios.debtToCashflow.debt)}/(${cfads('y1')}))`,
      ...(value === null ? {} : { result: value }),
    };
    debtRow.getCell(2).numFmt = '0.0';
  }

  // De solvabiliteit vraagt om een volledige balans; die staat niet in dit werkboek.
  const solvencyRow = sheet.getRow(10);
  solvencyRow.getCell(1).value = 'Solvabiliteit per 31-12 (uit de rekenkern)';
  result.meta.periods.forEach((_period, index) => {
    const target = solvencyRow.getCell(index + 2);
    target.value = result.ratios.solvency[index]?.value ?? '';
    target.numFmt = PERCENT_FORMAT;
  });

  sheet.getColumn(1).width = 40;
  for (let column = 2; column <= result.meta.periods.length + 1; column += 1) sheet.getColumn(column).width = 16;
}
