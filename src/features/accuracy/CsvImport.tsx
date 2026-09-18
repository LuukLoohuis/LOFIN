import { Upload } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Callout } from '../../components/ui/Callout';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { TextInput } from '../../components/ui/TextInput';
import { usePlanStore } from '../../data/planStore';
import type { ActualCategory } from '../../engine';
import { createId } from '../../lib/id';
import { applyMapping, parseCsv, suggestMapping, type ColumnMapping, type CsvTable } from '../../import/csv';

const CATEGORY_LABELS: { key: ActualCategory; label: string }[] = [
  { key: 'omzet', label: 'Omzet' },
  { key: 'inkoopwaarde', label: 'Inkoopwaarde' },
  { key: 'huur', label: 'Huisvesting' },
  { key: 'vervoer', label: 'Vervoer' },
  { key: 'verzekeringen', label: 'Verzekeringen' },
  { key: 'telefoon_software', label: 'Telefoon en software' },
  { key: 'accountant', label: 'Boekhouder' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'overig', label: 'Overig' },
  { key: 'personeel', label: 'Personeel' },
  { key: 'rente', label: 'Rente' },
  { key: 'aflossing', label: 'Aflossing' },
  { key: 'priveOpnamen', label: 'Privé-opnamen' },
  { key: 'eindsaldo', label: 'Banksaldo' },
];

interface CsvImportProps {
  startMonth: string;
  horizonMonths: number;
}

/**
 * Een export uit je boekhouding inlezen. De kolomindeling bewaar je onder een naam, zodat
 * de volgende maand één klik is.
 */
export function CsvImport({ startMonth, horizonMonths }: CsvImportProps) {
  const importActualMonths = usePlanStore((state) => state.importActualMonths);
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [mappingName, setMappingName] = useState('Mijn boekhoudexport');
  const [imported, setImported] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = table === null || mapping === null ? null : applyMapping(table, mapping, startMonth, horizonMonths);

  return (
    <Card
      title="Uit je boekhouding importeren"
      description="Een CSV-export met één regel per maand. Je kiest zelf welke kolom bij welke post hoort."
    >
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-white px-3.5 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50">
        <Upload className="size-4" aria-hidden />
        Kies een CSV-bestand
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file === undefined) return;
            setError(null);
            setImported(null);
            file
              .text()
              .then((text) => {
                const parsed = parseCsv(text);
                if (parsed.headers.length === 0) {
                  setError('In dit bestand staan geen kolomkoppen.');
                  return;
                }
                setTable(parsed);
                setMapping(suggestMapping(parsed.headers));
              })
              .catch(() => {
                setError('Het bestand kon niet worden gelezen.');
              });
          }}
        />
      </label>

      {error !== null && (
        <div className="mt-4">
          <Callout tone="error">{error}</Callout>
        </div>
      )}

      {table !== null && mapping !== null && (
        <div className="mt-5 flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Kolom met de maand" hint="Bijvoorbeeld 2027-03, 03-2027 of maart 2027.">
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={mapping.monthColumn}
                  options={table.headers.map((header) => ({ value: header, label: header }))}
                  onChange={(event) => {
                    setMapping({ ...mapping, monthColumn: event.target.value });
                  }}
                />
              )}
            </Field>

            {CATEGORY_LABELS.map((category) => (
              <Field key={category.key} label={category.label}>
                {({ id }) => (
                  <Select
                    id={id}
                    value={mapping.columns[category.key] ?? ''}
                    options={[
                      { value: '', label: 'Niet importeren' },
                      ...table.headers.map((header) => ({ value: header, label: header })),
                    ]}
                    onChange={(event) => {
                      const chosen = event.target.value;
                      const columns = Object.fromEntries(
                        Object.entries(mapping.columns).filter(([key]) => key !== category.key),
                      ) as ColumnMapping['columns'];
                      if (chosen !== '') columns[category.key] = chosen;
                      setMapping({ ...mapping, columns });
                    }}
                  />
                )}
              </Field>
            ))}
          </div>

          {preview !== null && (
            <>
              <Callout tone={preview.months.length === 0 ? 'warning' : 'info'}>
                {preview.months.length} {preview.months.length === 1 ? 'maand' : 'maanden'} gevonden
                {preview.skipped.length > 0 && `, ${preview.skipped.length} regels overgeslagen`}.
                {preview.skipped.length > 0 && (
                  <ul className="mt-2 list-inside list-disc">
                    {preview.skipped.slice(0, 5).map((entry) => (
                      <li key={`${entry.row}-${entry.reason}`}>
                        Regel {entry.row}: {entry.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </Callout>

              <div className="flex flex-wrap items-end gap-3">
                <Field label="Bewaar deze kolomindeling als" className="max-w-xs">
                  {({ id }) => (
                    <TextInput
                      id={id}
                      value={mappingName}
                      onChange={(event) => {
                        setMappingName(event.target.value);
                      }}
                    />
                  )}
                </Field>
                <Button
                  variant="primary"
                  disabled={preview.months.length === 0}
                  onClick={() => {
                    void usePlanStore
                      .getState()
                      .repository.saveMapping({ id: createId('mapping'), name: mappingName, mapping });
                    void importActualMonths(preview.months).then(() => {
                      setImported(preview.months.length);
                    });
                  }}
                >
                  Importeren
                </Button>
                {imported !== null && (
                  <span className="text-xs text-emerald-700">
                    {imported} {imported === 1 ? 'maand' : 'maanden'} ingelezen. Ze staan nog open; sluit ze af zodra de
                    cijfers definitief zijn.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
