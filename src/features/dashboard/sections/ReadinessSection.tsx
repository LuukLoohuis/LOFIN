import { Card } from '../../../components/ui/Card';
import { Callout } from '../../../components/ui/Callout';
import { ISSUE_MESSAGES } from '../../../config/texts';
import type { PlanResult } from '../../../engine';
import { formatPercent } from '../../../lib/format';

const FIELD_LABELS: Partial<Record<string, string>> = {
  'company.name': 'Naam van je onderneming (stap 1)',
  'company.kvkNumber': 'KvK-nummer (stap 1)',
  'company.description': 'Korte omschrijving (stap 1)',
  'history.years': 'Jaarcijfers (stap 3)',
  'need.purpose': 'Waar de financiering voor is (stap 2)',
  'financing.lines': 'Financiering die je aanvraagt (stap 5)',
  'financing.financierTypes': 'Soort financier (stap 5)',
  'explanations.ondernemer': 'Toelichting: over jou (stap 6)',
  'explanations.markt': 'Toelichting: markt en klanten (stap 6)',
  'explanations.investering': 'Toelichting: waarom deze investering (stap 6)',
  'explanations.opbrengst': 'Toelichting: wat het oplevert (stap 6)',
  'explanations.risicos': 'Toelichting: risico’s (stap 6)',
  'explanations.zekerheden': 'Toelichting: zekerheden (stap 6)',
  'plan.noErrors': 'Openstaande fouten in je invoer',
};

export function ReadinessSection({ result }: { result: PlanResult }) {
  const { completeness, issues } = result;
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const notes = issues.filter((issue) => issue.severity === 'info');
  const percentage = formatPercent(Math.round(completeness.score * 10_000), 0);

  return (
    <Card
      title="Klaar om in te dienen?"
      description="Het aandeel verplichte velden en documenten dat af is. Dit zegt niets over de kans dat je financiering krijgt."
    >
      <div className="flex items-center gap-4">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={Math.round(completeness.score * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Volledigheid van je dossier"
        >
          <div className="h-full rounded-full bg-blue-700" style={{ width: `${completeness.score * 100}%` }} />
        </div>
        <span className="text-sm font-semibold tabular-nums text-slate-900">{percentage}</span>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {errors.length > 0 && (
          <Callout tone="error" title="Dit moet eerst kloppen">
            <ul className="mt-1 list-inside list-disc">
              {errors.map((issue) => (
                <li key={`${issue.code}-${issue.path}`}>{ISSUE_MESSAGES[issue.code](issue.params)}</li>
              ))}
            </ul>
          </Callout>
        )}

        {warnings.length > 0 && (
          <Callout tone="warning" title="Hier zal een financier naar vragen">
            <ul className="mt-1 list-inside list-disc">
              {warnings.map((issue) => (
                <li key={`${issue.code}-${issue.path}`}>{ISSUE_MESSAGES[issue.code](issue.params)}</li>
              ))}
            </ul>
          </Callout>
        )}

        {notes.length > 0 && (
          <Callout tone="info" title="Goed om te weten">
            <ul className="mt-1 list-inside list-disc">
              {notes.map((issue) => (
                <li key={`${issue.code}-${issue.path}`}>{ISSUE_MESSAGES[issue.code](issue.params)}</li>
              ))}
            </ul>
          </Callout>
        )}

        {completeness.missingFields.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-800">Nog in te vullen</h3>
            <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
              {completeness.missingFields.map((field) => (
                <li key={field}>{FIELD_LABELS[field] ?? field}</li>
              ))}
            </ul>
          </div>
        )}

        {completeness.missingDocuments.length > 0 && (
          <p className="text-sm text-slate-600">
            Nog {completeness.missingDocuments.length} document
            {completeness.missingDocuments.length === 1 ? '' : 'en'} te verzamelen; zie de checklist hieronder.
          </p>
        )}
      </div>
    </Card>
  );
}
