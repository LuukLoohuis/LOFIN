import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { defaultEngineConfig } from '../../config';
import { calculatePlan } from '../../engine';
import { jansenPlan } from '../../engine/__tests__/fixtures/jansen';
import { buildWorkbook } from '../excel/workbook';
import { firstYearMonths, pnlTable } from '../tables';

const result = calculatePlan(jansenPlan, defaultEngineConfig);

/** Van centen naar euro's, zoals het werkboek ze opschrijft. */
const euro = (cents: number) => cents / 100;

async function reopen(): Promise<ExcelJS.Workbook> {
  const buffer = await buildWorkbook(jansenPlan, result).xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  return reopened;
}

describe('Excel-werkboek', () => {
  it('heeft de bladen die een boekhouder verwacht', async () => {
    const workbook = await reopen();
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Aannames',
      'Maanden',
      'Investeringen',
      'Exploitatie',
      'Liquiditeit',
      'Financiering',
      "Ratio's",
    ]);
  });

  it('rekent met formules die naar Aannames wijzen', async () => {
    const workbook = await reopen();
    const months = workbook.getWorksheet('Maanden');
    if (months === undefined) throw new Error('blad Maanden ontbreekt');

    const revenueRow = findRow(months, 'Omzet');
    const revenueCell = months.getRow(revenueRow).getCell(4);
    expect(revenueCell.formula).toContain('ROUND(');
    expect(revenueCell.formula).toContain('INDEX(');

    const levelRow = findRow(months, 'Omzetniveau');
    expect(months.getRow(levelRow).getCell(4).formula).toContain('Aannames!');
  });

  it('komt in de kerncellen precies uit op de rekenkern', async () => {
    const workbook = await reopen();
    const months = workbook.getWorksheet('Maanden');
    const operations = workbook.getWorksheet('Exploitatie');
    if (months === undefined || operations === undefined) throw new Error('bladen ontbreken');

    // Maand 1 (kolom D: kolom C is het startmoment).
    expect(value(months, findRow(months, 'Omzet'), 4)).toBe(euro(result.pnl.monthly[1]?.revenue ?? 0));
    expect(value(months, findRow(months, 'Bedrijfsresultaat'), 4)).toBe(euro(result.pnl.monthly[1]?.ebit ?? 0));
    expect(value(months, findRow(months, 'Eindsaldo'), 4)).toBe(euro(result.cashflow.monthly[1]?.closingCash ?? 0));
    expect(value(months, findRow(months, 'Rente: Zakelijke lening'), 4)).toBe(
      euro(result.loans[0]?.rows[1]?.interest ?? 0),
    );

    // Exploitatie: jaar 1 uit de testcasus.
    expect(value(operations, findRow(operations, 'Omzet'), 2)).toBe(150_000);
    expect(value(operations, findRow(operations, 'Bedrijfsresultaat'), 2)).toBe(68_500);
    expect(value(operations, findRow(operations, 'Kasstroom voor rente en aflossing'), 2)).toBe(31_900);
  });

  it('telt de maanden per boekjaar op met SUMIF', async () => {
    const workbook = await reopen();
    const operations = workbook.getWorksheet('Exploitatie');
    if (operations === undefined) throw new Error('blad Exploitatie ontbreekt');
    const formula = operations.getRow(findRow(operations, 'Omzet')).getCell(2).formula;
    expect(formula).toContain('SUMIF(');
    expect(formula).toContain('Maanden');
  });

  it('zet de aannames als losse, aanpasbare cellen neer', async () => {
    const workbook = await reopen();
    const sheet = workbook.getWorksheet('Aannames');
    if (sheet === undefined) throw new Error('blad Aannames ontbreekt');

    expect(cellValue(sheet, findRow(sheet, 'Inkoopwaarde van de omzet'), 2)).toBeCloseTo(0.35, 10);
    expect(cellValue(sheet, findRow(sheet, 'Omzetbasis per maand'), 2)).toBe(12_500);
    expect(cellValue(sheet, findRow(sheet, 'Privé-opname per maand'), 2)).toBe(3800);
  });

  it('zet het aflossingsschema en de ratio’s op hun eigen blad', async () => {
    const workbook = await reopen();
    const financing = workbook.getWorksheet('Financiering');
    const ratios = workbook.getWorksheet("Ratio's");
    if (financing === undefined || ratios === undefined) throw new Error('bladen ontbreken');

    expect(value(financing, findRow(financing, 'Rente'), 2)).toBeCloseTo(3225.80, 2);
    expect(value(financing, findRow(financing, 'Aflossing'), 2)).toBeCloseTo(8654.92, 2);

    const dscr = ratios.getRow(findRow(ratios, 'DSCR')).getCell(2);
    expect(dscr.formula).toContain('SUMIF(');
    expect(Number(cachedResult(dscr))).toBeCloseTo(2.685, 3);
  });
});

describe('gedeelde tabellen', () => {
  it('geven dashboard, pdf en Excel dezelfde regels', () => {
    const table = pnlTable(result);
    const revenue = table.rows.find((row) => row.label === 'Omzet');
    expect(revenue?.amounts[0]).toBe(result.pnl.periods[0]?.revenue);
    expect(table.columns).toEqual(['Jaar 1', 'Jaar 2', 'Jaar 3']);
    expect(firstYearMonths(result)).toHaveLength(13);
  });
});

function findRow(sheet: ExcelJS.Worksheet, label: string): number {
  let found = 0;
  sheet.eachRow((row, rowNumber) => {
    if (found === 0 && row.getCell(1).value === label) found = rowNumber;
  });
  if (found === 0) throw new Error(`Rij '${label}' niet gevonden op ${sheet.name}`);
  return found;
}

function cachedResult(target: ExcelJS.Cell): unknown {
  const raw: unknown = target.value;
  if (typeof raw === 'object' && raw !== null && 'result' in raw) return raw.result;
  return raw;
}

function value(sheet: ExcelJS.Worksheet, row: number, column: number): number {
  return Number(cachedResult(sheet.getRow(row).getCell(column)));
}

function cellValue(sheet: ExcelJS.Worksheet, row: number, column: number): number {
  return Number(sheet.getRow(row).getCell(column).value);
}
