import { BRANCH_PRESETS } from '../../../config';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { Callout } from '../../../components/ui/Callout';
import { Card } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Select } from '../../../components/ui/Select';
import { TextInput, Textarea } from '../../../components/ui/TextInput';
import { findBranchPreset, emptyRevenueModel } from '../../../data/defaultPlan';
import { WIZARD_STEPS } from '../../../schema/plan';
import { useWizard } from '../context';
import { useStepErrors } from '../usePlan';

const LEGAL_FORMS = [
  { value: 'eenmanszaak', label: 'Eenmanszaak (ook zzp)' },
  { value: 'vof', label: 'Vof' },
  { value: 'bv', label: 'Bv' },
];

export function StepOnderneming() {
  const { input, update } = useWizard();
  const errors = useStepErrors(WIZARD_STEPS[0], input);
  const company = input.company;

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Je onderneming"
        description="Deze gegevens staan straks op de voorkant van je financieringsdossier."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Rechtsvorm" error={errors['legalForm']}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                options={LEGAL_FORMS}
                value={company.legalForm}
                onChange={(event) => {
                  const legalForm = event.target.value as typeof company.legalForm;
                  update((draft) => {
                    draft.company.legalForm = legalForm;
                  });
                }}
              />
            )}
          </Field>

          <Field label="Naam van de onderneming" error={errors['name']}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={company.name}
                onChange={(event) => {
                  update((draft) => {
                    draft.company.name = event.target.value;
                  });
                }}
              />
            )}
          </Field>

          <Field
            label="KvK-nummer"
            hint="Acht cijfers. We controleren alleen de vorm; er gaat geen gegeven naar de KvK."
            error={errors['kvkNumber']}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                inputMode="numeric"
                aria-describedby={describedBy}
                invalid={invalid}
                value={company.kvkNumber}
                onChange={(event) => {
                  update((draft) => {
                    draft.company.kvkNumber = event.target.value;
                  });
                }}
              />
            )}
          </Field>

          <Field label="Branche" hint={findBranchPreset(company.sectorId).note} error={errors['sectorId']}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                options={BRANCH_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
                value={company.sectorId}
                onChange={(event) => {
                  const preset = findBranchPreset(event.target.value);
                  update((draft) => {
                    draft.company.sectorId = preset.id;
                    // Het voorbeeld vult de aannames; alles blijft aanpasbaar in stap 4.
                    draft.assumptions.seasonality = [...preset.seasonality];
                    draft.assumptions.costOfSalesBp = preset.costOfSalesBp;
                    draft.assumptions.debtorDays = preset.debtorDays;
                    draft.assumptions.creditorDays = preset.creditorDays;
                    if (draft.assumptions.revenue.kind !== preset.revenueModel) {
                      draft.assumptions.revenue = emptyRevenueModel(preset.revenueModel);
                    }
                  });
                }}
              />
            )}
          </Field>

          <Field
            label="Startdatum van de onderneming"
            hint="Laat leeg als je nog moet beginnen."
            error={errors['foundedOn']}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                type="date"
                aria-describedby={describedBy}
                invalid={invalid}
                value={company.foundedOn ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  update((draft) => {
                    draft.company.foundedOn = value === '' ? null : value;
                  });
                }}
              />
            )}
          </Field>

          <Field label="Aantal eigenaren" error={errors['ownerCount']}>
            {({ id, describedBy, invalid }) => (
              <NumberInput
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                value={company.ownerCount}
                onChange={(ownerCount) => {
                  update((draft) => {
                    draft.company.ownerCount = ownerCount;
                  });
                }}
              />
            )}
          </Field>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded-sm border-slate-300 text-blue-700 focus:outline-2 focus:outline-blue-700"
              checked={company.isStarter}
              onChange={(event) => {
                const isStarter = event.target.checked;
                update((draft) => {
                  draft.company.isStarter = isStarter;
                  if (isStarter) draft.history = { years: [], openingBalance: null };
                });
              }}
            />
            <span>
              <span className="font-medium text-slate-800">Ik ben een starter</span>
              <span className="block text-slate-600">
                Dan sla je stap 3 over: er zijn nog geen jaarcijfers. In plaats daarvan leg je in stap 6 extra goed
                uit waar je omzet vandaan komt.
              </span>
            </span>
          </label>

          <Field
            label="Korte omschrijving"
            hint="Wat doe je, voor wie, en waar? Twee of drie zinnen is genoeg."
            error={errors['description']}
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={company.description}
                onChange={(event) => {
                  update((draft) => {
                    draft.company.description = event.target.value;
                  });
                }}
              />
            )}
          </Field>
        </div>
      </Card>

      <Callout tone="info">
        We vragen nooit om je burgerservicenummer, rekeningnummer of bankinloggegevens. Die heb je alleen nodig bij
        de financier zelf.
      </Callout>
    </div>
  );
}
