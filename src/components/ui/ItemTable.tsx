import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface ItemTableProps {
  headers: readonly { label: string; align?: 'left' | 'right'; width?: string }[];
  empty: string;
  addLabel: string;
  onAdd: () => void;
  isEmpty: boolean;
  children: ReactNode;
}

/** Tabel met regels die je zelf toevoegt: investeringen, kostenposten, financieringsregels. */
export function ItemTable({ headers, empty, addLabel, onAdd, isEmpty, children }: ItemTableProps) {
  return (
    <div className="flex flex-col gap-3">
      {isEmpty ? (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-max min-w-full border-separate border-spacing-y-1 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                {headers.map((header) => (
                  <th
                    key={header.label}
                    scope="col"
                    className={header.align === 'right' ? 'px-2 pb-1 text-right' : 'px-2 pb-1'}
                    style={header.width === undefined ? undefined : { width: header.width }}
                  >
                    {header.label}
                  </th>
                ))}
                <th scope="col" className="w-10 px-2 pb-1">
                  <span className="sr-only">Verwijderen</span>
                </th>
              </tr>
            </thead>
            <tbody className="align-top">{children}</tbody>
          </table>
        </div>
      )}
      <div>
        <Button onClick={onAdd}>
          <Plus className="size-4" aria-hidden /> {addLabel}
        </Button>
      </div>
    </div>
  );
}

export function RemoveRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="danger" onClick={onClick} aria-label={label} className="px-2">
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}
