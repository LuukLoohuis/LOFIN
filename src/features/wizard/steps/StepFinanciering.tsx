import { MoneyInput } from '../../../components/inputs/MoneyInput';
import { MonthSelect } from '../../../components/inputs/MonthSelect';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { PercentInput } from '../../../components/inputs/PercentInput';
import { Callout } from '../../../components/ui/Callout';
import { Card } from '../../../components/ui/Card';
import { ItemTable, RemoveRowButton } from '../../../components/ui/ItemTable';
import { Select } from '../../../components/ui/Select';
import { TextInput } from '../../../components/ui/TextInput';
import type { FinancierType, FinancingLine, RepaymentType } from '../../../engine';
import { formatCents } from '../../../lib/format';
import { createId } from '../../../lib/id';
import { WIZARD_STEPS } from '../../../schema/plan';
import { useWizard } from '../context';
import { useStepErrors } from '../usePlan';
import { usePlanResult } from '../usePlanResult';

const LINE_KINDS: { value: FinancingLine['kind']; label: string }[] = [
  { value: 'lening', label: 'Lening' },
  { value: 'krediet', label: 'Rekening-courantkrediet' },
  { value: 'lease', label: 'Lease' },
  { value: 'achtergestelde_lening', label: 'Achtergestelde lening' },
];

const REPAYMENTS: { value: RepaymentType; label: string }[] = [
  { value: 'annuitair', label: 'Annuïtair' },
  { value: 'lineair', label: 'Lineair' },
  { value: 'aflossingsvrij', label: 'Aflossingsvrij' },
];

const FINANCIER_TYPES: { value: FinancierType; label: string; description: string }[] = [
  { value: 'bank', label: 'Bank', description: 'Vraagt doorgaans het meeste papierwerk.' },
  { value: 'microfinancier', label: 'Microfinancier', description: 'Kleinere bedragen, vaak met coaching.' },
  { value: 'crowdfunding', label: 'Crowdfunding', description: 'Je verhaal moet ook publiek overtuigen.' },
  { value: 'leasemaatschappij', label: 'Leasemaatschappij', description: 'Financiert een specifiek object.' },
  { value: 'kredietunie', label: 'Kredietunie', description: 'Ondernemers die elkaar financieren.' },
  { value: 'familie_vrienden', label: 'Familie of vrienden', description: 'Leg de afspraken schriftelijk vast.' },
];

export function StepFinanciering() {
  const { input, update } = useWizard();
  const errors = useStepErrors(WIZARD_STEPS[4], input);
  const result = usePlanResult(input);
  const { financing, assumptions } = input;

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Hoe wil je het financieren?"
        description="Elke regel is een lening, lease of krediet. Je eigen inbreng staat in stap 2."
      >
        <ItemTable
          headers={[
            { label: 'Omschrijving', width: '14rem' },
            { label: 'Soort', width: '12rem' },
            { label: 'Bedrag of limiet', align: 'right', width: '9rem' },
            { label: 'Rente', align: 'right', width: '6rem' },
            { label: 'Looptijd', align: 'right', width: '7rem' },
            { label: 'Aflossing', width: '9rem' },
            { label: 'Aflossingsvrij', align: 'right', width: '7rem' },
            { label: 'Start', width: '11rem' },
          ]}
          isEmpty={financing.lines.length === 0}
          empty="Nog geen financiering. Voeg de lening of het krediet toe dat je wilt aanvragen."
          addLabel="Financiering toevoegen"
          onAdd={() => {
            update((draft) => {
              draft.financing.lines.push({
                id: createId('fin'),
                kind: 'lening',
                description: 'Zakelijke lening',
                principalCents: Math.max(0, result?.financingNeed.financingNeed ?? 0),
                annualRateBp: 700,
                termMonths: 60,
                repayment: 'annuitair',
                graceMonths: 0,
                startMonth: 0,
                isRequested: true,
              });
            });
          }}
        >
          {financing.lines.map((line, index) => (
            <tr key={line.id} className="[&>td]:px-2 [&>td]:py-1">
              <td>
                <TextInput
                  aria-label="Omschrijving"
                  value={line.description}
                  onChange={(event) => {
                    const description = event.target.value;
                    update((draft) => {
                      const row = draft.financing.lines[index];
                      if (row) row.description = description;
                    });
                  }}
                />
              </td>
              <td>
                <Select
                  aria-label="Soort financiering"
                  options={LINE_KINDS}
                  value={line.kind}
                  onChange={(event) => {
                    const kind = event.target.value as FinancingLine['kind'];
                    update((draft) => {
                      const row = draft.financing.lines[index];
                      if (row === undefined) return;
                      draft.financing.lines[index] =
                        kind === 'krediet'
                          ? {
                              id: row.id,
                              kind,
                              description: row.description,
                              limitCents: row.kind === 'krediet' ? row.limitCents : row.principalCents,
                              annualRateBp: row.annualRateBp,
                              startMonth: row.startMonth,
                              isRequested: row.isRequested,
                            }
                          : {
                              id: row.id,
                              kind,
                              description: row.description,
                              principalCents: row.kind === 'krediet' ? row.limitCents : row.principalCents,
                              annualRateBp: row.annualRateBp,
                              termMonths: row.kind === 'krediet' ? 60 : row.termMonths,
                              repayment: row.kind === 'krediet' ? 'annuitair' : row.repayment,
                              graceMonths: row.kind === 'krediet' ? 0 : row.graceMonths,
                              startMonth: row.startMonth,
                              isRequested: row.isRequested,
                            };
                    });
                  }}
                />
              </td>
              <td>
                <MoneyInput
                  ariaLabel={line.kind === 'krediet' ? 'Kredietlimiet' : 'Hoofdsom'}
                  value={line.kind === 'krediet' ? line.limitCents : line.principalCents}
                  onChange={(amount) => {
                    update((draft) => {
                      const row = draft.financing.lines[index];
                      if (row === undefined) return;
                      if (row.kind === 'krediet') row.limitCents = amount;
                      else row.principalCents = amount;
                    });
                  }}
                />
              </td>
              <td>
                <PercentInput
                  ariaLabel="Rente per jaar"
                  value={line.annualRateBp}
                  onChange={(annualRateBp) => {
                    update((draft) => {
                      const row = draft.financing.lines[index];
                      if (row) row.annualRateBp = annualRateBp;
                    });
                  }}
                />
              </td>
              <td>
                {line.kind === 'krediet' ? (
                  <span className="block py-2 text-center text-xs text-slate-500">doorlopend</span>
                ) : (
                  <NumberInput
                    ariaLabel="Looptijd in maanden"
                    suffix="mnd"
                    value={line.termMonths}
                    onChange={(termMonths) => {
                      update((draft) => {
                        const row = draft.financing.lines[index];
                        if (row && row.kind !== 'krediet') row.termMonths = termMonths;
                      });
                    }}
                  />
                )}
              </td>
              <td>
                {line.kind === 'krediet' ? (
                  <span className="block py-2 text-center text-xs text-slate-500">—</span>
                ) : (
                  <Select
                    aria-label="Soort aflossing"
                    options={REPAYMENTS}
                    value={line.repayment}
                    onChange={(event) => {
                      const repayment = event.target.value as RepaymentType;
                      update((draft) => {
                        const row = draft.financing.lines[index];
                        if (row && row.kind !== 'krediet') row.repayment = repayment;
                      });
                    }}
                  />
                )}
              </td>
              <td>
                {line.kind === 'krediet' ? (
                  <span className="block py-2 text-center text-xs text-slate-500">—</span>
                ) : (
                  <NumberInput
                    ariaLabel="Aflossingsvrije periode in maanden"
                    suffix="mnd"
                    invalid={errors[`lines.${index}.graceMonths`] !== undefined}
                    value={line.graceMonths}
                    onChange={(graceMonths) => {
                      update((draft) => {
                        const row = draft.financing.lines[index];
                        if (row && row.kind !== 'krediet') row.graceMonths = graceMonths;
                      });
                    }}
                  />
                )}
              </td>
              <td>
                <MonthSelect
                  ariaLabel="Startmaand"
                  startMonth={assumptions.startMonth}
                  value={line.startMonth}
                  onChange={(startMonth) => {
                    update((draft) => {
                      const row = draft.financing.lines[index];
                      if (row) row.startMonth = startMonth;
                    });
                  }}
                />
              </td>
              <td>
                <RemoveRowButton
                  label="Verwijder financiering"
                  onClick={() => {
                    update((draft) => {
                      draft.financing.lines.splice(index, 1);
                    });
                  }}
                />
              </td>
            </tr>
          ))}
        </ItemTable>

        <div className="mt-4 flex flex-col gap-2">
          {financing.lines.map((line, index) => (
            <label key={line.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="size-4 rounded-sm border-slate-300 text-blue-700"
                checked={line.isRequested}
                onChange={(event) => {
                  const isRequested = event.target.checked;
                  update((draft) => {
                    const row = draft.financing.lines[index];
                    if (row) row.isRequested = isRequested;
                  });
                }}
              />
              <span>
                <strong className="font-medium">{line.description === '' ? 'Naamloze regel' : line.description}</strong>{' '}
                vraag ik aan bij een financier
                <span className="text-slate-500">
                  {' '}
                  — zet uit als dit al geregeld is, zoals een lening van familie.
                </span>
              </span>
            </label>
          ))}
        </div>

        {errors['lines'] !== undefined && <p className="mt-3 text-xs font-medium text-red-700">{errors['lines']}</p>}
      </Card>

      {result !== null && <FundingBalance result={result} />}

      <Card title="Lopende leningen" description="Verplichtingen die je nu al hebt. Ze tellen mee in je DSCR.">
        <ItemTable
          headers={[
            { label: 'Omschrijving', width: '18rem' },
            { label: 'Openstaand saldo', align: 'right', width: '10rem' },
            { label: 'Rente', align: 'right', width: '6rem' },
            { label: 'Resterende looptijd', align: 'right', width: '8rem' },
            { label: 'Aflossing', width: '9rem' },
          ]}
          isEmpty={financing.existingDebts.length === 0}
          empty="Geen lopende leningen."
          addLabel="Lopende lening toevoegen"
          onAdd={() => {
            update((draft) => {
              draft.financing.existingDebts.push({
                id: createId('schuld'),
                description: '',
                outstandingCents: 0,
                annualRateBp: 500,
                remainingMonths: 36,
                repayment: 'lineair',
              });
            });
          }}
        >
          {financing.existingDebts.map((debt, index) => (
            <tr key={debt.id} className="[&>td]:px-2 [&>td]:py-1">
              <td>
                <TextInput
                  aria-label="Omschrijving"
                  value={debt.description}
                  onChange={(event) => {
                    const description = event.target.value;
                    update((draft) => {
                      const row = draft.financing.existingDebts[index];
                      if (row) row.description = description;
                    });
                  }}
                />
              </td>
              <td>
                <MoneyInput
                  ariaLabel="Openstaand saldo"
                  value={debt.outstandingCents}
                  onChange={(outstandingCents) => {
                    update((draft) => {
                      const row = draft.financing.existingDebts[index];
                      if (row) row.outstandingCents = outstandingCents;
                    });
                  }}
                />
              </td>
              <td>
                <PercentInput
                  ariaLabel="Rente"
                  value={debt.annualRateBp}
                  onChange={(annualRateBp) => {
                    update((draft) => {
                      const row = draft.financing.existingDebts[index];
                      if (row) row.annualRateBp = annualRateBp;
                    });
                  }}
                />
              </td>
              <td>
                <NumberInput
                  ariaLabel="Resterende looptijd"
                  suffix="mnd"
                  value={debt.remainingMonths}
                  onChange={(remainingMonths) => {
                    update((draft) => {
                      const row = draft.financing.existingDebts[index];
                      if (row) row.remainingMonths = remainingMonths;
                    });
                  }}
                />
              </td>
              <td>
                <Select
                  aria-label="Soort aflossing"
                  options={REPAYMENTS}
                  value={debt.repayment}
                  onChange={(event) => {
                    const repayment = event.target.value as RepaymentType;
                    update((draft) => {
                      const row = draft.financing.existingDebts[index];
                      if (row) row.repayment = repayment;
                    });
                  }}
                />
              </td>
              <td>
                <RemoveRowButton
                  label="Verwijder lening"
                  onClick={() => {
                    update((draft) => {
                      draft.financing.existingDebts.splice(index, 1);
                    });
                  }}
                />
              </td>
            </tr>
          ))}
        </ItemTable>
      </Card>

      <Card
        title="Bij wat voor financier vraag je aan?"
        description="Bepaalt welke documenten op je checklist komen. We noemen en vergelijken geen financiers."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {FINANCIER_TYPES.map((type) => (
            <label key={type.value} className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded-sm border-slate-300 text-blue-700"
                checked={financing.financierTypes.includes(type.value)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  update((draft) => {
                    const types = new Set(draft.financing.financierTypes);
                    if (checked) types.add(type.value);
                    else types.delete(type.value);
                    draft.financing.financierTypes = [...types];
                  });
                }}
              />
              <span>
                <span className="font-medium text-slate-800">{type.label}</span>
                <span className="block text-slate-600">{type.description}</span>
              </span>
            </label>
          ))}
        </div>
        {errors['financierTypes'] !== undefined && (
          <p className="mt-3 text-xs font-medium text-red-700">{errors['financierTypes']}</p>
        )}
      </Card>
    </div>
  );
}

function FundingBalance({ result }: { result: NonNullable<ReturnType<typeof usePlanResult>> }) {
  const { uses, sources, difference } = result.financingNeed;

  return (
    <Card title="Sluit je financiering?" description="Bronnen en bestedingen horen exact gelijk te zijn.">
      <div className="grid gap-6 sm:grid-cols-2">
        <dl className="text-sm">
          <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">Bestedingen</p>
          <Row label="Investeringen" value={uses.investments} />
          <Row label="Werkkapitaal" value={uses.workingCapital} />
          <Row label="Eenmalige kosten" value={uses.oneOffCosts} />
          <Row label="Totaal" value={uses.total} emphasis />
        </dl>
        <dl className="text-sm">
          <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">Bronnen</p>
          <Row label="Eigen inbreng" value={sources.ownContribution} />
          <Row label="Subsidies en schenkingen" value={sources.grants} />
          <Row label="Al geregelde financiering" value={sources.otherFinancing} />
          <Row label="Aangevraagde financiering" value={sources.requestedFinancing} />
          <Row label="Totaal" value={sources.total} emphasis />
        </dl>
      </div>

      <div className="mt-4">
        {difference === 0 ? (
          <Callout tone="success">Je bronnen en bestedingen sluiten precies op elkaar aan.</Callout>
        ) : (
          <Callout tone="error" title="Er blijft een verschil staan">
            {difference > 0
              ? `Je hebt ${formatCents(difference)} meer financiering dan je nodig hebt.`
              : `Er ontbreekt nog ${formatCents(-difference)} aan financiering.`}{' '}
            Pas een bedrag aan of voeg een regel toe.
          </Callout>
        )}
      </div>
    </Card>
  );
}

function Row({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div
      className={`flex justify-between border-t border-slate-100 py-1.5 ${emphasis ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatCents(value)}</dd>
    </div>
  );
}
