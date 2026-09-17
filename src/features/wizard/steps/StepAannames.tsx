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
import { DEFAULT_COST_VAT_RATES } from '../../../config';
import { SEASONALITY_TOTAL, SEASONALITY_UNIT, type FixedCostCategory, type RevenueModel } from '../../../engine';
import { formatCents, formatNumber } from '../../../lib/format';
import { createId } from '../../../lib/id';
import { emptyRevenueModel, findBranchPreset } from '../../../data/defaultPlan';
import { WIZARD_STEPS } from '../../../schema/plan';
import { useWizard } from '../context';
import { useStepErrors } from '../usePlan';
import { usePlanResult } from '../usePlanResult';

const MONTH_LABELS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const REVENUE_MODELS: { value: RevenueModel['kind']; label: string }[] = [
  { value: 'uurtarief', label: 'Uurtarief × declarabele uren' },
  { value: 'opdrachten', label: 'Aantal opdrachten × gemiddelde opdrachtwaarde' },
  { value: 'maandbedrag', label: 'Vast bedrag per maand, met groei' },
];

const COST_CATEGORIES: { value: FixedCostCategory; label: string }[] = [
  { value: 'huur', label: 'Huisvesting' },
  { value: 'vervoer', label: 'Vervoer' },
  { value: 'verzekeringen', label: 'Verzekeringen' },
  { value: 'telefoon_software', label: 'Telefoon en software' },
  { value: 'accountant', label: 'Boekhouder' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'overig', label: 'Overig' },
];

export function StepAannames() {
  const { input, update } = useWizard();
  const errors = useStepErrors(WIZARD_STEPS[3], input);
  const result = usePlanResult(input);
  const { assumptions, company } = input;
  const seasonalityTotal = assumptions.seasonality.reduce((total, weight) => total + weight, 0);

  return (
    <div className="flex flex-col gap-6">
      <Card title="Wanneer begint de prognose?" description="Boekjaren lopen van januari tot en met december.">
        <div className="flex flex-wrap items-end gap-6">
          <Field label="Eerste prognosemaand" error={errors['startMonth']} className="max-w-xs">
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                type="month"
                aria-describedby={describedBy}
                invalid={invalid}
                value={assumptions.startMonth}
                onChange={(event) => {
                  const startMonth = event.target.value;
                  update((draft) => {
                    draft.assumptions.startMonth = startMonth;
                  });
                }}
              />
            )}
          </Field>
          {result !== null && (
            <p className="text-sm text-slate-600">
              Je prognose loopt over {result.meta.horizonMonths} maanden:{' '}
              {result.meta.periods
                .map((period) => (period.key === 'start' ? `${period.months} startmaanden` : String(period.calendarYear)))
                .join(' · ')}
              .
            </p>
          )}
        </div>
      </Card>

      <Card title="Omzet" description="Kies het model dat het beste bij je werk past.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Omzetmodel">
            {({ id }) => (
              <Select
                id={id}
                options={REVENUE_MODELS}
                value={assumptions.revenue.kind}
                onChange={(event) => {
                  const kind = event.target.value as RevenueModel['kind'];
                  update((draft) => {
                    draft.assumptions.revenue = emptyRevenueModel(kind);
                  });
                }}
              />
            )}
          </Field>
          <RevenueFields />
        </div>

        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-slate-800">Seizoenspatroon</h3>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  update((draft) => {
                    draft.assumptions.seasonality = Array.from({ length: 12 }, () => SEASONALITY_UNIT);
                  });
                }}
              >
                Alle maanden gelijk
              </Button>
              <Button
                onClick={() => {
                  const preset = findBranchPreset(company.sectorId);
                  update((draft) => {
                    draft.assumptions.seasonality = [...preset.seasonality];
                  });
                }}
              >
                Voorbeeld van je branche
              </Button>
            </div>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            1,00 is een gemiddelde maand. De twaalf maanden moeten samen op 12,00 uitkomen.
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-12">
            {assumptions.seasonality.map((weight, index) => (
              <label key={MONTH_LABELS[index]} className="flex flex-col gap-1 text-xs text-slate-600">
                {MONTH_LABELS[index]}
                <NumberInput
                  ariaLabel={`Gewicht ${MONTH_LABELS[index] ?? ''}`}
                  decimals={2}
                  value={weight / SEASONALITY_UNIT}
                  onChange={(value) => {
                    update((draft) => {
                      draft.assumptions.seasonality[index] = Math.round(value * SEASONALITY_UNIT);
                    });
                  }}
                />
              </label>
            ))}
          </div>
          <p
            className={`mt-2 text-xs font-medium ${seasonalityTotal === SEASONALITY_TOTAL ? 'text-slate-500' : 'text-red-700'}`}
          >
            Samen: {formatNumber(seasonalityTotal / SEASONALITY_UNIT, 2)} van 12,00
          </p>
        </div>
      </Card>

      <Card title="Kosten">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            label="Inkoopwaarde van de omzet"
            hint="Materiaal en inkoop als percentage van je omzet."
            error={errors['costOfSalesBp']}
          >
            {({ id, describedBy, invalid }) => (
              <PercentInput
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                decimals={0}
                value={assumptions.costOfSalesBp}
                onChange={(costOfSalesBp) => {
                  update((draft) => {
                    draft.assumptions.costOfSalesBp = costOfSalesBp;
                  });
                }}
              />
            )}
          </Field>
          <Field label="Btw op inkoop" hint="Meestal 21%.">
            {({ id, describedBy }) => (
              <PercentInput
                id={id}
                describedBy={describedBy}
                decimals={0}
                value={assumptions.costOfSalesVatRateBp}
                onChange={(vat) => {
                  update((draft) => {
                    draft.assumptions.costOfSalesVatRateBp = vat;
                  });
                }}
              />
            )}
          </Field>
          {result !== null && (
            <div className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Brutomarge jaar 1:{' '}
              <strong className="font-semibold text-slate-900">
                {formatCents(result.pnl.periods.find((row) => row.period === 'y1')?.grossMargin ?? 0)}
              </strong>
            </div>
          )}
        </div>

        <h3 className="mt-6 mb-2 text-sm font-medium text-slate-800">Vaste kosten</h3>
        <ItemTable
          headers={[
            { label: 'Kostenpost', width: '18rem' },
            { label: 'Soort', width: '12rem' },
            { label: 'Bedrag', align: 'right', width: '9rem' },
            { label: 'Per', width: '7rem' },
            { label: 'Btw', align: 'right', width: '6rem' },
          ]}
          isEmpty={assumptions.fixedCosts.length === 0}
          empty="Nog geen vaste kosten."
          addLabel="Kostenpost toevoegen"
          onAdd={() => {
            update((draft) => {
              draft.assumptions.fixedCosts.push({
                id: createId('kost'),
                category: 'overig',
                description: '',
                amountCents: 0,
                per: 'maand',
                vatRateBp: DEFAULT_COST_VAT_RATES.overig,
              });
            });
          }}
        >
          {assumptions.fixedCosts.map((line, index) => (
            <tr key={line.id} className="[&>td]:px-2 [&>td]:py-1">
              <td>
                <TextInput
                  aria-label="Kostenpost"
                  value={line.description}
                  onChange={(event) => {
                    const description = event.target.value;
                    update((draft) => {
                      const cost = draft.assumptions.fixedCosts[index];
                      if (cost) cost.description = description;
                    });
                  }}
                />
              </td>
              <td>
                <Select
                  aria-label="Soort kosten"
                  options={COST_CATEGORIES}
                  value={line.category}
                  onChange={(event) => {
                    const category = event.target.value as FixedCostCategory;
                    update((draft) => {
                      const cost = draft.assumptions.fixedCosts[index];
                      if (cost) {
                        cost.category = category;
                        cost.vatRateBp = DEFAULT_COST_VAT_RATES[category];
                      }
                    });
                  }}
                />
              </td>
              <td>
                <MoneyInput
                  ariaLabel="Bedrag"
                  value={line.amountCents}
                  onChange={(amountCents) => {
                    update((draft) => {
                      const cost = draft.assumptions.fixedCosts[index];
                      if (cost) cost.amountCents = amountCents;
                    });
                  }}
                />
              </td>
              <td>
                <Select
                  aria-label="Per maand of per jaar"
                  options={[
                    { value: 'maand', label: 'maand' },
                    { value: 'jaar', label: 'jaar' },
                  ]}
                  value={line.per}
                  onChange={(event) => {
                    const per = event.target.value === 'jaar' ? 'jaar' : 'maand';
                    update((draft) => {
                      const cost = draft.assumptions.fixedCosts[index];
                      if (cost) cost.per = per;
                    });
                  }}
                />
              </td>
              <td>
                <PercentInput
                  ariaLabel="Btw"
                  decimals={0}
                  value={line.vatRateBp}
                  onChange={(vatRateBp) => {
                    update((draft) => {
                      const cost = draft.assumptions.fixedCosts[index];
                      if (cost) cost.vatRateBp = vatRateBp;
                    });
                  }}
                />
              </td>
              <td>
                <RemoveRowButton
                  label="Verwijder kostenpost"
                  onClick={() => {
                    update((draft) => {
                      draft.assumptions.fixedCosts.splice(index, 1);
                    });
                  }}
                />
              </td>
            </tr>
          ))}
        </ItemTable>

        <h3 className="mt-6 mb-2 text-sm font-medium text-slate-800">Personeel</h3>
        <ItemTable
          headers={[
            { label: 'Functie', width: '16rem' },
            { label: 'Bruto per maand', align: 'right', width: '9rem' },
            { label: 'Werkgeverslasten', align: 'right', width: '8rem' },
            { label: 'Vanaf', width: '11rem' },
            { label: 'Tot en met', width: '10rem' },
          ]}
          isEmpty={assumptions.staff.length === 0}
          empty="Nog geen personeel. Je eigen inkomen hoort bij de privé-opnamen hieronder."
          addLabel="Medewerker toevoegen"
          onAdd={() => {
            update((draft) => {
              draft.assumptions.staff.push({
                id: createId('mw'),
                description: '',
                grossMonthlyCents: 0,
                employerCostBp: 3000,
                startMonth: 1,
                endMonth: null,
              });
            });
          }}
        >
          {assumptions.staff.map((line, index) => (
            <tr key={line.id} className="[&>td]:px-2 [&>td]:py-1">
              <td>
                <TextInput
                  aria-label="Functie"
                  value={line.description}
                  onChange={(event) => {
                    const description = event.target.value;
                    update((draft) => {
                      const staff = draft.assumptions.staff[index];
                      if (staff) staff.description = description;
                    });
                  }}
                />
              </td>
              <td>
                <MoneyInput
                  ariaLabel="Brutoloon per maand"
                  value={line.grossMonthlyCents}
                  onChange={(grossMonthlyCents) => {
                    update((draft) => {
                      const staff = draft.assumptions.staff[index];
                      if (staff) staff.grossMonthlyCents = grossMonthlyCents;
                    });
                  }}
                />
              </td>
              <td>
                <PercentInput
                  ariaLabel="Werkgeverslasten"
                  decimals={0}
                  value={line.employerCostBp}
                  onChange={(employerCostBp) => {
                    update((draft) => {
                      const staff = draft.assumptions.staff[index];
                      if (staff) staff.employerCostBp = employerCostBp;
                    });
                  }}
                />
              </td>
              <td>
                <MonthSelect
                  ariaLabel="Startmaand"
                  startMonth={assumptions.startMonth}
                  value={line.startMonth}
                  onChange={(startMonth) => {
                    update((draft) => {
                      const staff = draft.assumptions.staff[index];
                      if (staff) staff.startMonth = startMonth;
                    });
                  }}
                />
              </td>
              <td>
                <Select
                  aria-label="Laatste maand"
                  options={[
                    { value: '', label: 'Doorlopend' },
                    ...Array.from({ length: 47 }, (_, month) => ({
                      value: String(month + 1),
                      label: `maand ${month + 1}`,
                    })),
                  ]}
                  value={line.endMonth === null ? '' : String(line.endMonth)}
                  onChange={(event) => {
                    const value = event.target.value;
                    update((draft) => {
                      const staff = draft.assumptions.staff[index];
                      if (staff) staff.endMonth = value === '' ? null : Number(value);
                    });
                  }}
                />
              </td>
              <td>
                <RemoveRowButton
                  label="Verwijder medewerker"
                  onClick={() => {
                    update((draft) => {
                      draft.assumptions.staff.splice(index, 1);
                    });
                  }}
                />
              </td>
            </tr>
          ))}
        </ItemTable>
      </Card>

      {company.legalForm === 'bv' ? (
        <Card title="Dividend" description="Wat je als aandeelhouder per boekjaar uitkeert.">
          <div className="grid max-w-xl gap-5 sm:grid-cols-3">
            {(['y1', 'y2', 'y3'] as const).map((year, index) => (
              <Field key={year} label={`Boekjaar ${index + 1}`}>
                {({ id }) => (
                  <MoneyInput
                    id={id}
                    value={assumptions.dividendCents[year]}
                    onChange={(value) => {
                      update((draft) => {
                        draft.assumptions.dividendCents[year] = value;
                      });
                    }}
                  />
                )}
              </Field>
            ))}
          </div>
        </Card>
      ) : (
        <Card title="Privé-opnamen">
          <Field
            label="Privé-opname per maand"
            hint="Wat je maandelijks uit de zaak haalt om van te leven."
            error={errors['privateWithdrawalsMonthlyCents']}
            className="max-w-xs"
          >
            {({ id, describedBy, invalid }) => (
              <MoneyInput
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                value={assumptions.privateWithdrawalsMonthlyCents}
                onChange={(value) => {
                  update((draft) => {
                    draft.assumptions.privateWithdrawalsMonthlyCents = value;
                  });
                }}
              />
            )}
          </Field>
          <div className="mt-4">
            <Callout tone="info" title="Reken de belasting mee">
              Over je winst betaal je later inkomstenbelasting en Zvw-bijdrage. Dat geld gaat wel van je rekening, maar
              staat niet in je kosten. Reserveer daarom een deel van je opname — vaak een derde tot de helft. Een
              financier kijkt hier scherp naar: een te lage opname maakt je prognose ongeloofwaardig.
            </Callout>
          </div>
        </Card>
      )}

      <Card title="Betalen en btw">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Debiteurendagen" hint="Na hoeveel dagen betalen je klanten?" error={errors['debtorDays']}>
            {({ id, describedBy, invalid }) => (
              <NumberInput
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                suffix="dagen"
                value={assumptions.debtorDays}
                onChange={(debtorDays) => {
                  update((draft) => {
                    draft.assumptions.debtorDays = debtorDays;
                  });
                }}
              />
            )}
          </Field>
          <Field label="Crediteurendagen" hint="Na hoeveel dagen betaal jij?" error={errors['creditorDays']}>
            {({ id, describedBy, invalid }) => (
              <NumberInput
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                suffix="dagen"
                value={assumptions.creditorDays}
                onChange={(creditorDays) => {
                  update((draft) => {
                    draft.assumptions.creditorDays = creditorDays;
                  });
                }}
              />
            )}
          </Field>
          <Field label="Btw-tarief op je omzet">
            {({ id }) => (
              <PercentInput
                id={id}
                decimals={0}
                value={assumptions.vat.revenueRates[0]?.rateBp ?? 2100}
                onChange={(rateBp) => {
                  update((draft) => {
                    draft.assumptions.vat.revenueRates = [{ rateBp, shareBp: 10_000 }];
                  });
                }}
              />
            )}
          </Field>
          <Field label="Btw-aangifte">
            {({ id }) => (
              <Select
                id={id}
                options={[
                  { value: 'kwartaal', label: 'Per kwartaal' },
                  { value: 'maand', label: 'Per maand' },
                ]}
                value={assumptions.vat.filing}
                onChange={(event) => {
                  const filing = event.target.value === 'maand' ? 'maand' : 'kwartaal';
                  update((draft) => {
                    draft.assumptions.vat.filing = filing;
                  });
                }}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card title="Groei en buffer" description="Voor de twee boekjaren na je eerste volle jaar.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Omzetgroei jaar 2">
            {({ id }) => (
              <PercentInput
                id={id}
                decimals={0}
                value={assumptions.revenueGrowthBp.y2}
                onChange={(value) => {
                  update((draft) => {
                    draft.assumptions.revenueGrowthBp.y2 = value;
                  });
                }}
              />
            )}
          </Field>
          <Field label="Omzetgroei jaar 3">
            {({ id }) => (
              <PercentInput
                id={id}
                decimals={0}
                value={assumptions.revenueGrowthBp.y3}
                onChange={(value) => {
                  update((draft) => {
                    draft.assumptions.revenueGrowthBp.y3 = value;
                  });
                }}
              />
            )}
          </Field>
          <Field label="Kostenstijging jaar 2">
            {({ id }) => (
              <PercentInput
                id={id}
                decimals={0}
                value={assumptions.costGrowthBp.y2}
                onChange={(value) => {
                  update((draft) => {
                    draft.assumptions.costGrowthBp.y2 = value;
                  });
                }}
              />
            )}
          </Field>
          <Field label="Kostenstijging jaar 3">
            {({ id }) => (
              <PercentInput
                id={id}
                decimals={0}
                value={assumptions.costGrowthBp.y3}
                onChange={(value) => {
                  update((draft) => {
                    draft.assumptions.costGrowthBp.y3 = value;
                  });
                }}
              />
            )}
          </Field>
          <Field label="Minimale buffer" hint="Onder dit saldo wil je niet komen.">
            {({ id, describedBy }) => (
              <MoneyInput
                id={id}
                describedBy={describedBy}
                value={assumptions.minimumCashBufferCents}
                onChange={(value) => {
                  update((draft) => {
                    draft.assumptions.minimumCashBufferCents = value;
                  });
                }}
              />
            )}
          </Field>
        </div>
      </Card>
    </div>
  );
}

function RevenueFields() {
  const { input, update } = useWizard();
  const model = input.assumptions.revenue;

  if (model.kind === 'uurtarief') {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Uurtarief">
          {({ id }) => (
            <MoneyInput
              id={id}
              value={model.hourlyRateCents}
              onChange={(hourlyRateCents) => {
                update((draft) => {
                  if (draft.assumptions.revenue.kind === 'uurtarief') {
                    draft.assumptions.revenue.hourlyRateCents = hourlyRateCents;
                  }
                });
              }}
            />
          )}
        </Field>
        <Field label="Declarabele uren per maand" hint="Niet al je uren zijn declarabel; 60% is al veel.">
          {({ id, describedBy }) => (
            <NumberInput
              id={id}
              describedBy={describedBy}
              suffix="uur"
              value={model.billableHoursPerMonth}
              onChange={(hours) => {
                update((draft) => {
                  if (draft.assumptions.revenue.kind === 'uurtarief') {
                    draft.assumptions.revenue.billableHoursPerMonth = hours;
                  }
                });
              }}
            />
          )}
        </Field>
      </div>
    );
  }

  if (model.kind === 'opdrachten') {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Opdrachten per maand">
          {({ id }) => (
            <NumberInput
              id={id}
              decimals={1}
              value={model.jobsPerMonth}
              onChange={(jobsPerMonth) => {
                update((draft) => {
                  if (draft.assumptions.revenue.kind === 'opdrachten') {
                    draft.assumptions.revenue.jobsPerMonth = jobsPerMonth;
                  }
                });
              }}
            />
          )}
        </Field>
        <Field label="Gemiddelde opdrachtwaarde">
          {({ id }) => (
            <MoneyInput
              id={id}
              value={model.averageJobValueCents}
              onChange={(averageJobValueCents) => {
                update((draft) => {
                  if (draft.assumptions.revenue.kind === 'opdrachten') {
                    draft.assumptions.revenue.averageJobValueCents = averageJobValueCents;
                  }
                });
              }}
            />
          )}
        </Field>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Omzet in je eerste maand">
        {({ id }) => (
          <MoneyInput
            id={id}
            value={model.monthlyAmountCents}
            onChange={(monthlyAmountCents) => {
              update((draft) => {
                if (draft.assumptions.revenue.kind === 'maandbedrag') {
                  draft.assumptions.revenue.monthlyAmountCents = monthlyAmountCents;
                }
              });
            }}
          />
        )}
      </Field>
      <Field label="Groei per maand" hint="Geldt de eerste twaalf maanden; daarna groeit de omzet per boekjaar.">
        {({ id, describedBy }) => (
          <PercentInput
            id={id}
            describedBy={describedBy}
            decimals={1}
            value={model.monthlyGrowthBp}
            onChange={(monthlyGrowthBp) => {
              update((draft) => {
                if (draft.assumptions.revenue.kind === 'maandbedrag') {
                  draft.assumptions.revenue.monthlyGrowthBp = monthlyGrowthBp;
                }
              });
            }}
          />
        )}
      </Field>
    </div>
  );
}
