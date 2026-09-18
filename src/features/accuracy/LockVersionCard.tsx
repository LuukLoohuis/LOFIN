import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Callout } from '../../components/ui/Callout';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Textarea } from '../../components/ui/TextInput';
import { usePlanStore } from '../../data/planStore';
import { baselineVersion, type ForecastSnapshot, type PlanResult } from '../../engine';

interface LockVersionCardProps {
  result: PlanResult;
  versions: readonly ForecastSnapshot[];
}

/**
 * Vastzetten maakt een momentopname: die verandert nooit meer. De eerste is de versie die je
 * indient; elke latere is een bijstelling met een reden erbij.
 */
export function LockVersionCard({ result, versions }: LockVersionCardProps) {
  const lockVersion = usePlanStore((state) => state.lockVersion);
  const hasBaseline = baselineVersion(versions) !== null;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const hasErrors = result.issues.some((issue) => issue.severity === 'error');

  return (
    <Card
      title={hasBaseline ? 'Nieuwe prognose vastzetten' : 'Prognose vastzetten als ingediend'}
      description={
        hasBaseline
          ? 'Leg vast hoe je er nu over denkt. De vorige versies blijven staan, zodat je kunt zien hoe je verwachting schoof.'
          : 'Bewaar de prognose zoals je hem indient. Daarna vergelijk je je realisatie steeds met deze versie.'
      }
    >
      {hasErrors && (
        <div className="mb-4">
          <Callout tone="error" title="Er staan nog fouten in je plan">
            Los die eerst op; anders zet je een prognose vast die niet klopt.
          </Callout>
        </div>
      )}

      <Field
        label={hasBaseline ? 'Waarom stel je bij?' : 'Notitie (optioneel)'}
        hint={hasBaseline ? 'Bijvoorbeeld: rustige zomer, minder verbouwingen.' : 'Bijvoorbeeld: ingediend bij de bank.'}
      >
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            rows={2}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        )}
      </Field>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={busy || hasErrors}
          onClick={() => {
            setBusy(true);
            void lockVersion({
              kind: hasBaseline ? 'reforecast' : 'baseline',
              note: note.trim() === '' ? null : note.trim(),
              result,
              today: new Date().toISOString().slice(0, 10),
            })
              .then(() => {
                setDone(true);
                setNote('');
              })
              .finally(() => {
                setBusy(false);
              });
          }}
        >
          <Lock className="size-4" aria-hidden />
          {hasBaseline ? 'Nieuwe prognose vastzetten' : 'Prognose vastzetten als ingediend'}
        </Button>
        {done && <span className="text-xs text-emerald-700">Vastgezet. Deze versie verandert niet meer.</span>}
      </div>
    </Card>
  );
}
