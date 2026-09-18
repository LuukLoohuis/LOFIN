import { Check, Lock } from 'lucide-react';
import { useState } from 'react';
import { MoneyInput } from '../../components/inputs/MoneyInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { usePlanStore } from '../../data/planStore';
import type { ActualCategory, ActualMonth, MonthMeta } from '../../engine';
import { cn } from '../../lib/cn';
import { formatYearMonth } from '../../lib/format';

const GROUPS: { title: string; categories: { key: ActualCategory; label: string }[] }[] = [
  {
    title: 'Omzet en inkoop',
    categories: [
      { key: 'omzet', label: 'Omzet' },
      { key: 'inkoopwaarde', label: 'Inkoopwaarde' },
    ],
  },
  {
    title: 'Vaste kosten',
    categories: [
      { key: 'huur', label: 'Huisvesting' },
      { key: 'vervoer', label: 'Vervoer' },
      { key: 'verzekeringen', label: 'Verzekeringen' },
      { key: 'telefoon_software', label: 'Telefoon en software' },
      { key: 'accountant', label: 'Boekhouder' },
      { key: 'marketing', label: 'Marketing' },
      { key: 'overig', label: 'Overig' },
      { key: 'personeel', label: 'Personeel' },
    ],
  },
  {
    title: 'Financiering en privé',
    categories: [
      { key: 'rente', label: 'Rente' },
      { key: 'aflossing', label: 'Aflossing' },
      { key: 'priveOpnamen', label: 'Privé-opnamen' },
      { key: 'eindsaldo', label: 'Banksaldo aan het eind van de maand' },
    ],
  },
];

interface ActualsFormProps {
  months: readonly MonthMeta[];
  actuals: readonly ActualMonth[];
  horizonMonths: number;
}

export function ActualsForm({ months, actuals, horizonMonths }: ActualsFormProps) {
  const saveActualMonth = usePlanStore((state) => state.saveActualMonth);
  const firstOpen = findFirstOpenMonth(actuals, horizonMonths);
  const [selected, setSelected] = useState(firstOpen);
  const existing = actuals.find((month) => month.month === selected);
  const [draft, setDraft] = useState<Partial<Record<ActualCategory, number>>>(existing?.values ?? {});
  const [saved, setSaved] = useState(false);

  const selectMonth = (month: number) => {
    setSelected(month);
    setDraft(actuals.find((candidate) => candidate.month === month)?.values ?? {});
    setSaved(false);
  };

  const store = (status: ActualMonth['status']) => {
    void saveActualMonth({ month: selected, status, source: 'handmatig', values: draft }).then(() => {
      setSaved(true);
    });
  };

  return (
    <Card
      title="Realisatie invoeren"
      description="Dezelfde posten als in je prognose. Een maand telt pas mee zodra je hem afsluit."
      actions={
        <Field label="Maand" className="w-56">
          {({ id }) => (
            <Select
              id={id}
              value={String(selected)}
              options={Array.from({ length: horizonMonths }, (_, index) => {
                const month = index + 1;
                const meta = months[month];
                const closed = actuals.some(
                  (candidate) => candidate.month === month && candidate.status === 'afgesloten',
                );
                return {
                  value: String(month),
                  label: `${month}. ${meta === undefined ? '' : formatYearMonth(`${meta.year}-${String(meta.month).padStart(2, '0')}`)}${closed ? ' ✓' : ''}`,
                };
              })}
              onChange={(event) => {
                selectMonth(Number(event.target.value));
              }}
            />
          )}
        </Field>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 text-sm font-medium text-slate-800">{group.title}</h3>
            <div className="flex flex-col gap-3">
              {group.categories.map((category) => (
                <Field key={category.key} label={category.label}>
                  {({ id }) => (
                    <MoneyInput
                      id={id}
                      value={draft[category.key] ?? 0}
                      onChange={(amount) => {
                        setDraft((current) => ({ ...current, [category.key]: amount }));
                        setSaved(false);
                      }}
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            store('open');
          }}
        >
          Tussentijds bewaren
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            store('afgesloten');
          }}
        >
          <Lock className="size-4" aria-hidden /> Maand afsluiten
        </Button>
        <span className={cn('text-xs', saved ? 'text-emerald-700' : 'text-slate-500')}>
          {saved ? (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3.5" aria-hidden /> Opgeslagen
            </span>
          ) : (
            'Alleen afgesloten maanden tellen mee in de kengetallen.'
          )}
        </span>
      </div>
    </Card>
  );
}

function findFirstOpenMonth(actuals: readonly ActualMonth[], horizonMonths: number): number {
  const closed = new Set(
    actuals.filter((month) => month.status === 'afgesloten').map((month) => month.month),
  );
  for (let month = 1; month <= horizonMonths; month++) {
    if (!closed.has(month)) return month;
  }
  return horizonMonths;
}
