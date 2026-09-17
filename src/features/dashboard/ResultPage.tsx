import { Callout } from '../../components/ui/Callout';
import { Card } from '../../components/ui/Card';
import { formatCents, formatNumber, formatPercent } from '../../lib/format';
import { useWizard } from '../wizard/context';
import { usePlanResult } from '../wizard/usePlanResult';

/** Voorproefje van het dashboard; de volledige uitwerking komt in fase 3. */
export function ResultPage() {
  const { input } = useWizard();
  const result = usePlanResult(input);

  if (result === null) {
    return (
      <Callout tone="warning" title="Nog niet door te rekenen">
        Controleer de startmaand in stap 4.
      </Callout>
    );
  }

  const year1 = result.pnl.periods.find((row) => row.period === 'y1');
  const dscr = result.ratios.dscr.find((ratio) => ratio.period === 'y1');
  const errors = result.issues.filter((issue) => issue.severity === 'error');

  return (
    <div className="flex flex-col gap-6">
      <Card title="Hoe je ervoor staat" description="Een eerste blik; het volledige dashboard volgt in fase 3.">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Financieringsbehoefte" value={formatCents(result.financingNeed.financingNeed)} />
          <Metric label="Omzet jaar 1" value={formatCents(year1?.revenue ?? 0)} />
          <Metric
            label="DSCR jaar 1"
            value={dscr?.value === null || dscr === undefined ? '—' : formatNumber(dscr.value, 2)}
            tone={dscr?.light}
          />
          <Metric
            label="Laagste kassaldo"
            value={formatCents(result.ratios.lowestCash.amount)}
            tone={result.ratios.lowestCash.light}
          />
        </dl>
      </Card>

      <Card title="Klaar om in te dienen?" description="Het aandeel verplichte velden en documenten dat af is.">
        <div className="flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-700" style={{ width: `${result.completeness.score * 100}%` }} />
          </div>
          <span className="text-sm font-semibold text-slate-900">
            {formatPercent(Math.round(result.completeness.score * 10_000), 0)}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Dit zegt iets over de volledigheid van je dossier, niet over de kans dat je financiering krijgt.
        </p>
      </Card>

      {errors.length > 0 && (
        <Callout tone="error" title="Dit moet eerst kloppen">
          <ul className="list-inside list-disc">
            {errors.map((issue) => (
              <li key={`${issue.code}-${issue.path}`}>{describeIssue(issue.code)}</li>
            ))}
          </ul>
        </Callout>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string | undefined }) {
  const color = tone === 'rood' ? 'text-red-700' : tone === 'oranje' ? 'text-amber-700' : 'text-slate-900';
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

function describeIssue(code: string): string {
  switch (code) {
    case 'FUNDING_IMBALANCE':
      return 'Je bronnen en bestedingen sluiten niet op elkaar aan (stap 5).';
    case 'SEASONALITY_INVALID':
      return 'De twaalf seizoensmaanden komen niet samen op 12,00 uit (stap 4).';
    case 'VAT_MIX_INVALID':
      return 'De btw-verdeling over je omzet is geen 100% (stap 4).';
    case 'GRACE_TOO_LONG':
      return 'Een aflossingsvrije periode is even lang als of langer dan de looptijd (stap 5).';
    default:
      return 'Er staat nog een fout in je invoer.';
  }
}
