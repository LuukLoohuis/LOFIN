import { cn } from '../../lib/cn';

export interface FinancialRow {
  label: string;
  values: readonly string[];
  /** Totaalregel: dikker en met een lijn erboven. */
  emphasis?: boolean;
  /** Onderdeel van de regel erboven. */
  indent?: boolean;
  tone?: 'default' | 'negative';
}

interface FinancialTableProps {
  columns: readonly string[];
  rows: readonly FinancialRow[];
  rowHeader?: string;
  caption?: string;
}

/** Tabel met bedragen: eerste kolom blijft staan, cijfers rechts uitgelijnd en op één lijn. */
export function FinancialTable({ columns, rows, rowHeader = 'Post', caption }: FinancialTableProps) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-max text-sm">
        {caption !== undefined && <caption className="mb-2 text-left text-xs text-slate-500">{caption}</caption>}
        <thead>
          <tr className="border-b border-slate-200">
            <th scope="col" className="sticky left-0 bg-white py-2 pr-4 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              {rowHeader}
            </th>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-3 py-2 text-right text-xs font-medium tracking-wide text-slate-500 uppercase"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={cn(
                'border-b border-slate-100 last:border-0',
                row.emphasis === true && 'border-t border-slate-300 font-semibold text-slate-900',
              )}
            >
              <th
                scope="row"
                className={cn(
                  'sticky left-0 bg-white py-1.5 pr-4 text-left font-normal text-slate-700',
                  row.emphasis === true && 'font-semibold text-slate-900',
                  row.indent === true && 'pl-4 text-slate-500',
                )}
              >
                {row.label}
              </th>
              {row.values.map((value, index) => (
                <td
                  key={`${row.label}-${columns[index] ?? index}`}
                  className={cn(
                    'px-3 py-1.5 text-right tabular-nums',
                    row.tone === 'negative' && 'text-red-700',
                    row.indent === true && 'text-slate-500',
                  )}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
