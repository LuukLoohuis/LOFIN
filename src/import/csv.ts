import Papa from 'papaparse';
import { addMonths, parseYearMonth, type ActualCategory, type ActualMonth, type Cents } from '../engine';
import { parseEuroInput } from '../lib/format';

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ColumnMapping {
  /** Kolom met de maand. */
  monthColumn: string;
  /** Per post de kolomnaam; ontbreekt de post, dan importeren we hem niet. */
  columns: Partial<Record<ActualCategory, string>>;
}

export interface ImportResult {
  months: ActualMonth[];
  /** Regels die we niet konden plaatsen, met de reden erbij. */
  skipped: { row: number; reason: string }[];
}

const MONTH_NAMES = [
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

/** Woorden die we in kolomkoppen herkennen, per post. */
const HEADER_HINTS: Record<ActualCategory, readonly string[]> = {
  omzet: ['omzet', 'opbrengst', 'revenue', 'netto-omzet'],
  inkoopwaarde: ['inkoop', 'kostprijs', 'materiaal', 'cost of sales'],
  huur: ['huur', 'huisvesting'],
  vervoer: ['vervoer', 'auto', 'brandstof', 'transport'],
  verzekeringen: ['verzekering'],
  telefoon_software: ['telefoon', 'software', 'ict', 'abonnement'],
  accountant: ['accountant', 'boekhoud', 'administratie'],
  marketing: ['marketing', 'reclame', 'advertentie'],
  overig: ['overig', 'divers', 'algemene kosten'],
  personeel: ['personeel', 'loon', 'salaris'],
  priveOpnamen: ['privé', 'prive', 'opname'],
  rente: ['rente', 'interest'],
  aflossing: ['aflossing', 'termijn'],
  eindsaldo: ['saldo', 'bank', 'liquide'],
};

export function parseCsv(text: string): CsvTable {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: '',
    transformHeader: (header) => header.trim(),
  });
  return { headers: parsed.meta.fields ?? [], rows: parsed.data };
}

/** Een eerste gok op basis van de kolomkoppen; je past hem daarna zelf aan. */
export function suggestMapping(headers: readonly string[]): ColumnMapping {
  const lower = headers.map((header) => header.toLowerCase());
  const find = (hints: readonly string[]): string | undefined => {
    const index = lower.findIndex((header) => hints.some((hint) => header.includes(hint)));
    return index === -1 ? undefined : headers[index];
  };

  const columns: Partial<Record<ActualCategory, string>> = {};
  for (const [category, hints] of Object.entries(HEADER_HINTS)) {
    const match = find(hints);
    if (match !== undefined) columns[category as ActualCategory] = match;
  }

  const monthColumn = find(['maand', 'periode', 'datum', 'month']) ?? headers[0] ?? '';
  // De maandkolom is nooit ook een bedrag.
  const withoutMonthColumn = Object.fromEntries(
    Object.entries(columns).filter(([, column]) => column !== monthColumn),
  ) as Partial<Record<ActualCategory, string>>;

  return { monthColumn, columns: withoutMonthColumn };
}

/** '2027-03', '03-2027', '2027-03-31' en 'maart 2027' worden allemaal herkend. */
export function parseMonthCell(value: string): { year: number; month: number } | null {
  const trimmed = value.trim().toLowerCase();

  const iso = /^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/.exec(trimmed);
  if (iso !== null) return valid(Number(iso[1]), Number(iso[2]));

  const dutch = /^(\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (dutch !== null) return valid(Number(dutch[2]), Number(dutch[1]));

  const named = /^([a-z]+)[\s-]+(\d{4})$/.exec(trimmed);
  if (named !== null) {
    const index = MONTH_NAMES.findIndex((name) => name.startsWith(named[1] ?? ''));
    if (index !== -1) return valid(Number(named[2]), index + 1);
  }

  return null;
}

function valid(year: number, month: number): { year: number; month: number } | null {
  return month >= 1 && month <= 12 ? { year, month } : null;
}

/** Zet de rijen om in maanden van de prognose; alles wat niet past, komt terug als melding. */
export function applyMapping(
  table: CsvTable,
  mapping: ColumnMapping,
  startMonth: string,
  horizonMonths: number,
): ImportResult {
  const start = parseYearMonth(startMonth);
  const months: ActualMonth[] = [];
  const skipped: ImportResult['skipped'] = [];
  if (start === null) return { months, skipped: [{ row: 0, reason: 'De startmaand van het plan klopt niet' }] };

  table.rows.forEach((row, index) => {
    const rowNumber = index + 2; // regel 1 is de kop
    const parsed = parseMonthCell(row[mapping.monthColumn] ?? '');
    if (parsed === null) {
      skipped.push({ row: rowNumber, reason: 'Geen maand gevonden in de kolom met de periode' });
      return;
    }

    const monthIndex = (parsed.year - start.year) * 12 + (parsed.month - start.month) + 1;
    if (monthIndex < 1 || monthIndex > horizonMonths) {
      skipped.push({ row: rowNumber, reason: `${monthLabel(parsed)} valt buiten je prognose` });
      return;
    }

    const values: Partial<Record<ActualCategory, Cents>> = {};
    for (const [category, column] of Object.entries(mapping.columns)) {
      const raw = row[column];
      if (raw === undefined || raw.trim() === '') continue;
      const amount = parseEuroInput(raw);
      if (amount === null) {
        skipped.push({ row: rowNumber, reason: `'${raw}' in kolom ${column} is geen bedrag` });
        continue;
      }
      // Kosten mogen met een minteken in de export staan; wij tellen ze positief.
      values[category as ActualCategory] = category === 'eindsaldo' ? amount : Math.abs(amount);
    }

    if (Object.keys(values).length === 0) {
      skipped.push({ row: rowNumber, reason: 'Geen bedragen gevonden' });
      return;
    }

    months.push({ month: monthIndex, status: 'open', source: 'csv', values });
  });

  return { months, skipped };
}

function monthLabel(value: { year: number; month: number }): string {
  return `${MONTH_NAMES[value.month - 1] ?? value.month} ${value.year}`;
}

/** Voor de CSV-import van banktransacties later; nu nog niet in gebruik. */
export interface TransactionImporter {
  id: string;
  label: string;
  parse: (file: string) => Promise<ActualMonth[]>;
}

export { addMonths };
