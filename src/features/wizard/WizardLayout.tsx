import { Check, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router';
import { DISCLAIMER } from '../../config';
import { usePlanStore } from '../../data/planStore';
import { cn } from '../../lib/cn';
import { WIZARD_STEPS } from '../../schema/plan';
import { Button } from '../../components/ui/Button';
import type { WizardContext } from './context';
import { useStepCompletion } from './usePlan';

export function WizardLayout() {
  const { planId, slug } = useParams();
  const navigate = useNavigate();
  const plan = usePlanStore((state) => state.plan);
  const loading = usePlanStore((state) => state.loading);
  const status = usePlanStore((state) => state.status);
  const loadPlan = usePlanStore((state) => state.loadPlan);
  const rename = usePlanStore((state) => state.rename);
  const update = usePlanStore((state) => state.update);
  const completion = useStepCompletion(plan?.input ?? null);

  useEffect(() => {
    if (planId !== undefined) void loadPlan(planId);
  }, [planId, loadPlan]);

  if (loading) return <p className="p-10 text-sm text-slate-500">Bezig met laden…</p>;

  if (plan === null) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Dit plan bestaat niet (meer)</h1>
        <p className="mt-2 text-sm text-slate-600">
          Plannen worden in deze browser bewaard. Op een ander apparaat zie je ze pas na het aanmaken van een account.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-blue-700 underline">
          Terug naar je plannen
        </Link>
      </div>
    );
  }

  const onResult = slug === 'resultaat';
  const currentIndex = WIZARD_STEPS.findIndex((step) => step.slug === slug);
  const previous = onResult ? WIZARD_STEPS[WIZARD_STEPS.length - 1] : currentIndex > 0 ? WIZARD_STEPS[currentIndex - 1] : undefined;
  const next = onResult ? undefined : WIZARD_STEPS[currentIndex + 1];

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm font-semibold tracking-tight text-slate-900">
              LOFI
            </Link>
            <span className="text-slate-300">/</span>
            <input
              aria-label="Naam van het plan"
              className="rounded-sm border border-transparent px-1.5 py-0.5 text-sm font-medium text-slate-800 hover:border-slate-300 focus:border-slate-300 focus:outline-2 focus:outline-blue-700"
              value={plan.name}
              onChange={(event) => {
                rename(event.target.value);
              }}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <SaveIndicator status={status} />
            <Link to={`/plan/${plan.id}/resultaat`} className="font-medium text-blue-700 underline">
              Naar het resultaat
            </Link>
          </div>
        </div>
      </header>

      <nav aria-label="Stappen" className="border-b border-slate-200 bg-white">
        <ol className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
          {WIZARD_STEPS.map((step) => {
            const done = completion[step.step] === true;
            const active = step.slug === slug;
            return (
              <li key={step.slug}>
                <Link
                  to={`/plan/${plan.id}/${step.slug}`}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition',
                    active ? 'bg-blue-50 font-medium text-blue-800' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-xs',
                      done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600',
                    )}
                  >
                    {done ? <Check className="size-3" aria-hidden /> : step.step}
                  </span>
                  {step.title}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet context={{ planId: plan.id, input: plan.input, update } satisfies WizardContext} />

        <div className="mt-8 flex items-center justify-between">
          {previous !== undefined ? (
            <Button
              onClick={() => {
                void navigate(`/plan/${plan.id}/${previous.slug}`);
              }}
            >
              <ChevronLeft className="size-4" aria-hidden /> {previous.title}
            </Button>
          ) : (
            <span />
          )}
          {next !== undefined && (
            <Button
              variant="primary"
              onClick={() => {
                void navigate(`/plan/${plan.id}/${next.slug}`);
              }}
            >
              {next.title} <ChevronRight className="size-4" aria-hidden />
            </Button>
          )}
          {next === undefined && !onResult && (
            <Button
              variant="primary"
              onClick={() => {
                void navigate(`/plan/${plan.id}/resultaat`);
              }}
            >
              Naar het resultaat <ChevronRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>

        <p className="mt-10 text-xs leading-relaxed text-slate-500">{DISCLAIMER}</p>
      </main>
    </div>
  );
}

function SaveIndicator({ status }: { status: 'leeg' | 'opgeslagen' | 'bezig' | 'fout' }) {
  if (status === 'bezig') {
    return (
      <span className="flex items-center gap-1.5">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Bezig met opslaan…
      </span>
    );
  }
  if (status === 'fout') return <span className="font-medium text-red-700">Opslaan lukte niet</span>;
  if (status === 'opgeslagen') {
    return (
      <span className="flex items-center gap-1.5">
        <Check className="size-3.5 text-emerald-600" aria-hidden /> Opgeslagen in deze browser
      </span>
    );
  }
  return null;
}
