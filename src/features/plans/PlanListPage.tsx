import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextInput } from '../../components/ui/TextInput';
import { DISCLAIMER } from '../../config';
import { usePlanStore } from '../../data/planStore';
import type { PlanSummary } from '../../data/planRepository';
import { useSession } from '../auth/session';
import { createDemoCase } from '../../demo/loodgieter';

export function PlanListPage() {
  const navigate = useNavigate();
  const user = useSession((state) => state.user);
  const createPlan = usePlanStore((state) => state.createPlan);
  const listPlans = usePlanStore((state) => state.listPlans);
  const removePlan = usePlanStore((state) => state.removePlan);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    void listPlans().then(setPlans);
  }, [listPlans]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="mb-6 flex justify-end text-sm">
          {user === null ? (
            <Link to="/inloggen" className="font-medium text-blue-700 underline">
              Inloggen
            </Link>
          ) : (
            <Link to="/account" className="font-medium text-blue-700 underline">
              {user.email}
            </Link>
          )}
        </div>
        <p className="text-sm font-medium text-slate-500">LOFI — Loohuis Finance &amp; AI</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Financieringsdossier</h1>
        <p className="mt-3 max-w-2xl text-slate-700">
          Zet je plan om in cijfers waar een financier mee kan werken: investeringsbegroting, exploitatie, liquiditeit
          per maand, aflossingen en ratio’s. Je vult in gewone taal in, wij rekenen het door.
        </p>

        <Card className="mt-8" title="Nieuw plan">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createPlan(name).then((plan) => navigate(`/plan/${plan.id}/onderneming`));
            }}
          >
            <label className="flex-1">
              <span className="mb-1.5 block text-sm font-medium text-slate-800">Naam van je plan</span>
              <TextInput
                placeholder="Bijvoorbeeld: bus en gereedschap 2027"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            </label>
            <Button variant="primary" type="submit">
              Beginnen
            </Button>
          </form>
          <p className="mt-4 text-xs text-slate-500">
            Liever eerst kijken?{' '}
            <button
              type="button"
              className="font-medium text-blue-700 underline"
              onClick={() => {
                const demo = createDemoCase();
                const repository = usePlanStore.getState().repository;
                void (async () => {
                  await repository.save(demo.plan);
                  const existing = await repository.listVersions(demo.plan.id);
                  if (existing.length === 0) {
                    for (const version of demo.versions) await repository.addVersion(demo.plan.id, version);
                    for (const month of demo.actuals) await repository.saveActualMonth(demo.plan.id, month);
                  }
                  await navigate(`/plan/${demo.plan.id}/realisatie`);
                })();
              }}
            >
              Open de voorbeeldcasus
            </button>{' '}
            — een loodgieter met veertien maanden realisatie en een bijgestelde prognose.
          </p>
        </Card>

        {plans.length > 0 && (
          <Card className="mt-6" title="Je plannen" description="Bewaard in deze browser.">
            <ul className="divide-y divide-slate-100">
              {plans.map((plan) => (
                <li key={plan.id} className="flex items-center justify-between gap-4 py-2.5">
                  <Link to={`/plan/${plan.id}/onderneming`} className="text-sm font-medium text-blue-700 underline">
                    {plan.name}
                  </Link>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{new Date(plan.updatedAt).toLocaleDateString('nl-NL')}</span>
                    <Button
                      variant="danger"
                      onClick={() => {
                        void removePlan(plan.id).then(() => listPlans().then(setPlans));
                      }}
                    >
                      Verwijderen
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <p className="mt-10 text-xs leading-relaxed text-slate-500">{DISCLAIMER}</p>
        <p className="mt-3 flex gap-4 text-xs text-slate-500">
          <Link to="/privacy" className="underline">
            Privacy
          </Link>
          <Link to="/cookies" className="underline">
            Cookies
          </Link>
        </p>
      </div>
    </div>
  );
}
