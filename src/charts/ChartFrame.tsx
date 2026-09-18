import { Table2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';

interface ChartFrameProps {
  title: string;
  description?: string;
  /** Wordt voorgelezen in plaats van de grafiek. */
  summary: string;
  table: { columns: readonly string[]; rows: readonly (readonly string[])[] };
  children: ReactNode;
  actions?: ReactNode;
}

/** Elke grafiek heeft een samenvatting voor schermlezers en een tabel met dezelfde cijfers. */
export function ChartFrame({ title, description, summary, table, children, actions }: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description !== undefined && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <Button
            onClick={() => {
              setShowTable((current) => !current);
            }}
            aria-expanded={showTable}
          >
            <Table2 className="size-4" aria-hidden /> {showTable ? 'Grafiek' : 'Tabel'}
          </Button>
        </div>
      </header>

      {showTable ? (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">{summary}</caption>
            <thead>
              <tr className="border-b border-slate-200">
                {table.columns.map((column) => (
                  <th key={column} scope="col" className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row[0]} className="border-b border-slate-100 last:border-0">
                  {row.map((value, index) => (
                    <td
                      key={`${row[0] ?? ''}-${table.columns[index] ?? index}`}
                      className={index === 0 ? 'px-3 py-1.5 text-slate-700' : 'px-3 py-1.5 text-right tabular-nums'}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <figure className="m-0">
          <div role="img" aria-label={summary}>
            {children}
          </div>
        </figure>
      )}
    </section>
  );
}
