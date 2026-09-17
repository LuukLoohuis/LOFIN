import { useState } from 'react';
import { MoneyInput } from '../../../components/inputs/MoneyInput';
import { MonthSelect } from '../../../components/inputs/MonthSelect';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { PercentInput } from '../../../components/inputs/PercentInput';
import { Button } from '../../../components/ui/Button';
import { Callout } from '../../../components/ui/Callout';
import { Card } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { ItemTable, RemoveRowButton } from '../../../components/ui/ItemTable';
import { Select } from '../../../components/ui/Select';
import { TextInput } from '../../../components/ui/TextInput';
import { defaultEngineConfig } from '../../../config';
import {
  baseMonthlyRevenue,
  estimateWorkingCapital,
  type InvestmentCategory,
  type PlanInput,
  type PlanResult,
} from '../../../engine';
import { formatCents, formatYearMonth } from '../../../lib/format';
import { createId } from '../../../lib/id';
import { WIZARD_STEPS } from '../../../schema/plan';
import { useWizard } from '../context';
import { useStepErrors } from '../usePlan';
import { usePlanResult } from '../usePlanResult';

const CATEGORIES: { value: InvestmentCategory; label: string }[] = [
  { value: 'bedrijfsmiddel', label: 'Bedrijfsmiddel' },
  { value: 'verbouwing', label: 'Verbouwing' },
  { value: 'voorraad', label: 'Voorraad' },
  { value: 'immaterieel', label: 'Immaterieel' },
  { value: 'overig', label: 'Overig' },
];

export function StepBehoefte() {
  const { input, update } = useWizard();
  const errors = useStepErrors(WIZARD_STEPS[1], input);
  const result = usePlanResult(input);
  const { need } = input;
  const startMonth = input.assumptions.startMonth;

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Investeringen"
        description="Wat ga je kopen? Bedragen exclusief btw. De btw komt hieronder apart terug."
      >
        <ItemTable
          headers={[
            { label: 'Omschrijving', width: '16rem' },
            { label: 'Soort', width: '10rem' },
            { label: 'Bedrag excl. btw', align: 'right', width: '9rem' },
            { label: 'Btw', align: 'right', width: '6rem' },
            { label: 'Afschrijving', align: 'right', width: '7rem' },
            { label: 'Restwaarde', align: 'right', width: '9rem' },
            { label: 'Aanschaf', width: '11rem' },
          ]}
          isEmpty={need.investments.length === 0}
          empty="Nog geen investeringen. Voeg toe wat je met de financiering wilt kopen."
          addLabel="Investering toevoegen"
          onAdd={() => {
            update((draft) => {
              draft.need.investments.push({
                id: createId('inv'),
                description: '',
                category: 'bedrijfsmiddel',
                amountCents: 0,
                vatRateBp: 2100,
                lifeYears: 5,
                residualValueCents: 0,
                purchaseMonth: 0,
              });
            });
          }}
        >
          {need.investments.map((item, index) => (
            <tr key={item.id} className="[&>td]:px-2 [&>td]:py-1">
              <td>
                <TextInput
                  aria-label="Omschrijving"
                  invalid={errors[`investments.${index}.description`] !== undefined}
                  value={item.description}
                  onChange={(event) => {
                    const description = event.target.value;
                    update((draft) => {
                      const line = draft.need.investments[index];
                      if (line) line.description = description;
                    });
                  }}
                />
              </td>
              <td>
                <Select
                  aria-label="Soort investering"
                  options={CATEGORIES}
                  value={item.category}
                  onChange={(event) => {
                    const category = event.target.value as InvestmentCategory;
                    update((draft) => {
                      const line = draft.need.investments[index];
                      if (line) {
                        line.category = category;
                        if (category === 'voorraad') line.lifeYears = null;
                      }
                    });
                  }}
                />
              </td>
              <td>
                <MoneyInput
                  ariaLabel="Bedrag exclusief btw"
                  value={item.amountCents}
                  onChange={(amountCents) => {
                    update((draft) => {
                      const line = draft.need.investments[index];
                      if (line) line.amountCents = amountCents;
                    });
                  }}
                />
              </td>
              <td>
                <PercentInput
                  ariaLabel="Btw-tarief"
                  decimals={0}
                  value={item.vatRateBp}
                  onChange={(vatRateBp) => {
                    update((draft) => {
                      const line = draft.need.investments[index];
                      if (line) line.vatRateBp = vatRateBp;
                    });
                  }}
                />
              </td>
              <td>
                <NumberInput
                  ariaLabel="Afschrijving in jaren"
                  suffix="jaar"
                  value={item.lifeYears ?? 0}
                  onChange={(years) => {
                    update((draft) => {
                      const line = draft.need.investments[index];
                      if (line) line.lifeYears = years === 0 ? null : years;
                    });
                  }}
                />
              </td>
              <td>
                <MoneyInput
                  ariaLabel="Restwaarde"
                  invalid={errors[`investments.${index}.residualValueCents`] !== undefined}
                  value={item.residualValueCents}
                  onChange={(residualValueCents) => {
                    update((draft) => {
                      const line = draft.need.investments[index];
                      if (line) line.residualValueCents = residualValueCents;
                    });
                  }}
                />
              </td>
              <td>
                <MonthSelect
                  ariaLabel="Maand van aanschaf"
                  startMonth={startMonth}
                  value={item.purchaseMonth}
                  onChange={(purchaseMonth) => {
                    update((draft) => {
                      const line = draft.need.investments[index];
                      if (line) line.purchaseMonth = purchaseMonth;
                    });
                  }}
                />
              </td>
              <td>
                <RemoveRowButton
                  label={`Verwijder ${item.description === '' ? 'investering' : item.description}`}
                  onClick={() => {
                    update((draft) => {
                      draft.need.investments.splice(index, 1);
                    });
                  }}
                />
              </td>
            </tr>
          ))}
        </ItemTable>
        {need.investments.some((_, index) => errors[`investments.${index}.residualValueCents`] !== undefined) && (
          <p className="mt-2 text-xs font-medium text-red-700">
            De restwaarde kan niet hoger zijn dan de aanschafprijs.
          </p>
        )}
      </Card>

      <WorkingCapitalCard />

      <Card title="Eenmalige kosten" description="Kosten die je één keer maakt om te kunnen starten.">
        <ItemTable
          headers={[
            { label: 'Omschrijving', width: '22rem' },
            { label: 'Bedrag excl. btw', align: 'right', width: '9rem' },
            { label: 'Btw', align: 'right', width: '6rem' },
            { label: 'Maand', width: '11rem' },
          ]}
          isEmpty={need.oneOffCosts.length === 0}
          empty="Denk aan notaris, inschrijving, advies of een verhuizing."
          addLabel="Kostenpost toevoegen"
          onAdd={() => {
            update((draft) => {
              draft.need.oneOffCosts.push({
                id: createId('kost'),
                description: '',
                amountCents: 0,
                vatRateBp: 2100,
                month: 0,
              });
            });
          }}
        >
          {need.oneOffCosts.map((cost, index) => (
            <tr key={cost.id} className="[&>td]:px-2 [&>td]:py-1">
              <td>
                <TextInput
                  aria-label="Omschrijving"
                  value={cost.description}
                  onChange={(event) => {
                    const description = event.target.value;
                    update((draft) => {
                      const line = draft.need.oneOffCosts[index];
                      if (line) line.description = description;
                    });
                  }}
                />
              </td>
              <td>
                <MoneyInput
                  ariaLabel="Bedrag exclusief btw"
                  value={cost.amountCents}
                  onChange={(amountCents) => {
                    update((draft) => {
                      const line = draft.need.oneOffCosts[index];
                      if (line) line.amountCents = amountCents;
                    });
                  }}
                />
              </td>
              <td>
                <PercentInput
                  ariaLabel="Btw-tarief"
                  decimals={0}
                  value={cost.vatRateBp}
                  onChange={(vatRateBp) => {
                    update((draft) => {
                      const line = draft.need.oneOffCosts[index];
                      if (line) line.vatRateBp = vatRateBp;
                    });
                  }}
                />
              </td>
              <td>
                <MonthSelect
                  ariaLabel="Maand"
                  startMonth={startMonth}
                  value={cost.month}
                  onChange={(month) => {
                    update((draft) => {
                      const line = draft.need.oneOffCosts[index];
                      if (line) line.month = month;
                    });
                  }}
                />
              </td>
              <td>
                <RemoveRowButton
                  label="Verwijder kostenpost"
                  onClick={() => {
                    update((draft) => {
                      draft.need.oneOffCosts.splice(index, 1);
                    });
                  }}
                />
              </td>
            </tr>
          ))}
        </ItemTable>
      </Card>

      <Card
        title="Eigen inbreng en andere bronnen"
        description="Wat breng je zelf in, en welk geld hoeft niet terugbetaald te worden?"
      >
        <Field
          label="Eigen inbreng"
          hint="Spaargeld of geld dat je al in de onderneming hebt gestopt. Financiers kijken hier als eerste naar."
          error={errors['ownContributionCents']}
          className="max-w-xs"
        >
          {({ id, describedBy, invalid }) => (
            <MoneyInput
              id={id}
              describedBy={describedBy}
              invalid={invalid}
              value={need.ownContributionCents}
              onChange={(ownContributionCents) => {
                update((draft) => {
                  draft.need.ownContributionCents = ownContributionCents;
                });
              }}
            />
          )}
        </Field>

        <div className="mt-5">
          <h3 className="mb-2 text-sm font-medium text-slate-800">Subsidies en schenkingen</h3>
          <ItemTable
            headers={[
              { label: 'Omschrijving', width: '22rem' },
              { label: 'Bedrag', align: 'right', width: '9rem' },
              { label: 'Maand', width: '11rem' },
            ]}
            isEmpty={need.grants.length === 0}
            empty="Alleen geld dat je niet terugbetaalt. Een lening van familie hoort in stap 5."
            addLabel="Bron toevoegen"
            onAdd={() => {
              update((draft) => {
                draft.need.grants.push({ id: createId('bron'), description: '', amountCents: 0, month: 0 });
              });
            }}
          >
            {need.grants.map((grant, index) => (
              <tr key={grant.id} className="[&>td]:px-2 [&>td]:py-1">
                <td>
                  <TextInput
                    aria-label="Omschrijving"
                    value={grant.description}
                    onChange={(event) => {
                      const description = event.target.value;
                      update((draft) => {
                        const line = draft.need.grants[index];
                        if (line) line.description = description;
                      });
                    }}
                  />
                </td>
                <td>
                  <MoneyInput
                    ariaLabel="Bedrag"
                    value={grant.amountCents}
                    onChange={(amountCents) => {
                      update((draft) => {
                        const line = draft.need.grants[index];
                        if (line) line.amountCents = amountCents;
                      });
                    }}
                  />
                </td>
                <td>
                  <MonthSelect
                    ariaLabel="Maand"
                    startMonth={startMonth}
                    value={grant.month}
                    onChange={(month) => {
                      update((draft) => {
                        const line = draft.need.grants[index];
                        if (line) line.month = month;
                      });
                    }}
                  />
                </td>
                <td>
                  <RemoveRowButton
                    label="Verwijder bron"
                    onClick={() => {
                      update((draft) => {
                        draft.need.grants.splice(index, 1);
                      });
                    }}
                  />
                </td>
              </tr>
            ))}
          </ItemTable>
        </div>
      </Card>

      {result !== null && <NeedSummary result={result} />}
    </div>
  );
}

function NeedSummary({ result }: { result: PlanResult }) {
  const { uses, sources, financingNeed, vatOnInvestments } = result.financingNeed;
  const settlementMonth = vatOnInvestments.settlements[0]?.settledInMonth ?? null;
  const settlementText =
    settlementMonth === null ? '' : `, in ${formatYearMonth(monthLabel(result, settlementMonth))}`;

  return (
    <Card title="Wat je nodig hebt">
      <dl className="divide-y divide-slate-100 text-sm">
        <SummaryRow label="Investeringen" value={formatCents(uses.investments)} />
        <SummaryRow label="Werkkapitaal" value={formatCents(uses.workingCapital)} />
        <SummaryRow label="Eenmalige kosten" value={formatCents(uses.oneOffCosts)} />
        <SummaryRow label="Eigen inbreng" value={`− ${formatCents(sources.ownContribution)}`} />
        <SummaryRow label="Subsidies en schenkingen" value={`− ${formatCents(sources.grants)}`} />
        <SummaryRow label="Al geregelde financiering" value={`− ${formatCents(sources.otherFinancing)}`} />
        <SummaryRow label="Financieringsbehoefte" value={formatCents(financingNeed)} emphasis />
      </dl>

      {vatOnInvestments.total > 0 && (
        <div className="mt-4">
          <Callout tone="warning" title="Vergeet de btw niet">
            Je betaalt {formatCents(vatOnInvestments.total)} btw over je investeringen. Dat geld ben je tijdelijk kwijt:
            je krijgt het terug bij de eerstvolgende btw-aangifte{settlementText}. Houd daar rekening mee in je
            werkkapitaal.
          </Callout>
        </div>
      )}
    </Card>
  );
}

function monthLabel(result: PlanResult, index: number): string {
  const meta = result.meta.months[index];
  return meta === undefined ? '' : `${meta.year}-${String(meta.month).padStart(2, '0')}`;
}

function SummaryRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${emphasis ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** Werkkapitaal met een rekenhulp op basis van betaaltermijnen en voorraad. */
function WorkingCapitalCard() {
  const { input, update } = useWizard();
  const [open, setOpen] = useState(false);
  const [stockDays, setStockDays] = useState(30);
  const annualRevenue = estimateAnnualRevenue(input);

  const suggestion = estimateWorkingCapital(
    {
      annualRevenueCents: annualRevenue,
      annualCostOfSalesCents: Math.round((annualRevenue * input.assumptions.costOfSalesBp) / 10_000),
      debtorDays: input.assumptions.debtorDays,
      creditorDays: input.assumptions.creditorDays,
      stockDays,
    },
    defaultEngineConfig.daysPerMonth,
  );

  return (
    <Card
      title="Werkkapitaal"
      description="Geld dat vastzit in klanten die nog niet betaald hebben en in voorraad, min wat jij nog aan leveranciers moet betalen."
    >
      <div className="flex flex-wrap items-end gap-6">
        <Field label="Werkkapitaal" className="max-w-xs flex-1">
          {({ id }) => (
            <MoneyInput
              id={id}
              value={input.need.workingCapitalCents}
              onChange={(workingCapitalCents) => {
                update((draft) => {
                  draft.need.workingCapitalCents = workingCapitalCents;
                });
              }}
            />
          )}
        </Field>
        <Button
          onClick={() => {
            setOpen((value) => !value);
          }}
        >
          {open ? 'Rekenhulp sluiten' : 'Reken het voor me uit'}
        </Button>
      </div>

      {open && (
        <div className="mt-5 rounded-md bg-slate-50 p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Debiteurendagen" hint="Na hoeveel dagen betalen je klanten?">
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={input.assumptions.debtorDays}
                  onChange={(debtorDays) => {
                    update((draft) => {
                      draft.assumptions.debtorDays = debtorDays;
                    });
                  }}
                />
              )}
            </Field>
            <Field label="Crediteurendagen" hint="Na hoeveel dagen betaal jij je leveranciers?">
              {({ id }) => (
                <NumberInput
                  id={id}
                  value={input.assumptions.creditorDays}
                  onChange={(creditorDays) => {
                    update((draft) => {
                      draft.assumptions.creditorDays = creditorDays;
                    });
                  }}
                />
              )}
            </Field>
            <Field label="Voorraaddagen" hint="Hoe lang ligt je voorraad gemiddeld?">
              {({ id }) => <NumberInput id={id} value={stockDays} onChange={setStockDays} />}
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              Met een jaaromzet van {formatCents(annualRevenue)} kom je uit op ongeveer{' '}
              <strong className="font-semibold text-slate-900">{formatCents(suggestion)}</strong>.
            </p>
            <Button
              variant="primary"
              onClick={() => {
                update((draft) => {
                  draft.need.workingCapitalCents = suggestion;
                });
              }}
            >
              Neem dit bedrag over
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function estimateAnnualRevenue(input: PlanInput): number {
  return Math.round(baseMonthlyRevenue(input.assumptions.revenue) * 12);
}
