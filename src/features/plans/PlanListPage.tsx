import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextInput } from '../../components/ui/TextInput';
import { DISCLAIMER } from '../../config';
import { usePlanStore } from '../../data/planStore';
import type { PlanSummary } from '../../data/planRepository';

export function PlanListPage() {
  const navigate = useNavigate();
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
      </div>
    </div>
  );
}
