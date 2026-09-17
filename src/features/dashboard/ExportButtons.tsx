import { Download, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import type { PlanInput, PlanResult } from '../../engine';

type Busy = 'pdf' | 'excel' | null;

/** Beide bestanden worden in je browser gemaakt; er gaat niets naar een server. */
export function ExportButtons({
  input,
  result,
  planName,
}: {
  input: PlanInput;
  result: PlanResult;
  planName: string;
}) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (kind: Exclude<Busy, null>, task: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    task()
      .catch(() => {
        setError('Het bestand maken lukte niet. Probeer het nog eens.');
      })
      .finally(() => {
        setBusy(null);
      });
  };

  const preparedOn = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          disabled={busy !== null}
          onClick={() => {
            run('pdf', async () => {
              const { downloadDossierPdf } = await import('../../exports/pdf/renderDossier');
              await downloadDossierPdf({ input, result, planName, preparedOn });
            });
          }}
        >
          {busy === 'pdf' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
          Dossier als pdf
        </Button>
        <Button
          disabled={busy !== null}
          onClick={() => {
            run('excel', async () => {
              const { downloadWorkbook } = await import('../../exports/excel/downloadWorkbook');
              await downloadWorkbook({ input, result, planName });
            });
          }}
        >
          {busy === 'excel' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
          Excel met formules
        </Button>
      </div>
      {error !== null && <p className="text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
