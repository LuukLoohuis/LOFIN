import type { FinancialRow } from '../../components/ui/FinancialTable';
import type { Cents } from '../../engine';
import { formatCents } from '../../lib/format';

export interface MoneyRow {
  label: string;
  amounts: readonly Cents[];
  emphasis?: boolean;
  indent?: boolean;
  tone?: 'default' | 'negative';
}

/** Zet bedragen om in tabelregels en laat regels weg die overal nul zijn. */
export function moneyRows(rows: readonly MoneyRow[]): FinancialRow[] {
  return rows
    .filter((row) => row.emphasis === true || row.amounts.some((amount) => amount !== 0))
    .map(
      (row): FinancialRow => ({
        label: row.label,
        values: row.amounts.map(formatCents),
        ...(row.emphasis === undefined ? {} : { emphasis: row.emphasis }),
        ...(row.indent === undefined ? {} : { indent: row.indent }),
        ...(row.tone === undefined ? {} : { tone: row.tone }),
      }),
    );
}
