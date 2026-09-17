import { Card } from '../../../components/ui/Card';
import { cn } from '../../../lib/cn';
import type { DocumentStatus, PlanResult } from '../../../engine';
import { useWizard } from '../../wizard/context';

export function ChecklistSection({ result }: { result: PlanResult }) {
  const { input, update } = useWizard();

  if (result.checklist.length === 0) {
    return (
      <Card title="Documentenchecklist" description="Kies in stap 5 bij wat voor financier je aanvraagt.">
        <p className="text-sm text-slate-600">
          Zodra je aangeeft waar je aanklopt, zetten we de documenten op een rij die daar gebruikelijk zijn.
        </p>
      </Card>
    );
  }

  const required = result.checklist.filter((item) => item.required);
  const optional = result.checklist.filter((item) => !item.required);

  const setStatus = (id: string, status: DocumentStatus) => {
    update((draft) => {
      draft.documents[id] = status;
    });
  };

  return (
    <Card
      title="Documentenchecklist"
      description="Wat je bij dit soort financiers meestal moet aanleveren. Verzamel het vooraf; dat scheelt een ronde vragen."
    >
      <ul className="flex flex-col gap-2">
        {[...required, ...optional].map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-slate-200 p-3"
          >
            <div className="min-w-[16rem] flex-1">
              <p className="text-sm font-medium text-slate-800">
                {item.label}
                {!item.required && <span className="ml-2 text-xs font-normal text-slate-500">optioneel</span>}
              </p>
              <p className="text-xs text-slate-500">{item.description}</p>
            </div>
            <div className="flex gap-1" role="group" aria-label={`Status van ${item.label}`}>
              {(['heb_ik', 'nog_regelen'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={item.status === status}
                  onClick={() => {
                    setStatus(item.id, status);
                  }}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition',
                    item.status === status
                      ? status === 'heb_ik'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {status === 'heb_ik' ? 'Heb ik' : 'Nog regelen'}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        {result.checklist.filter((item) => item.status === 'heb_ik').length} van {result.checklist.length} verzameld ·
        {' '}
        {Object.keys(input.documents).length === 0 ? 'nog niets aangevinkt' : 'je keuzes worden bewaard'}
      </p>
    </Card>
  );
}
