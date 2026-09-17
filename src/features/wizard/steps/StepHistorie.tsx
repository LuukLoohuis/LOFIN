import { Link } from 'react-router';
import { MoneyInput } from '../../../components/inputs/MoneyInput';
import { NumberInput } from '../../../components/inputs/NumberInput';
import { Button } from '../../../components/ui/Button';
import { Callout } from '../../../components/ui/Callout';
import { Card } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import type { Cents, FixedCostCategory, HistoricalYear, OpeningBalanceInput } from '../../../engine';
import { formatCents } from '../../../lib/format';
import { useWizard } from '../context';

const PNL_ROWS: { label: string; key: keyof Pick<HistoricalYear, 'revenueCents' | 'costOfSalesCents' | 'staffCents' | 'depreciationCents' | 'interestCents' | 'netProfitCents' | 'privateWithdrawalsCents'> }[] = [
  { label: 'Omzet', key: 'revenueCents' },
  { label: 'Inkoopwaarde', key: 'costOfSalesCents' },
  { label: 'Personeel', key: 'staffCents' },
  { label: 'Afschrijving', key: 'depreciationCents' },
  { label: 'Rente', key: 'interestCents' },
  { label: 'Nettowinst', key: 'netProfitCents' },
  { label: 'Privé-opnamen', key: 'privateWithdrawalsCents' },
];

const COST_ROWS: { label: string; key: FixedCostCategory }[] = [
  { label: 'Huur', key: 'huur' },
  { label: 'Vervoer', key: 'vervoer' },
  { label: 'Verzekeringen', key: 'verzekeringen' },
  { label: 'Telefoon en software', key: 'telefoon_software' },
  { label: 'Boekhouder', key: 'accountant' },
  { label: 'Marketing', key: 'marketing' },
  { label: 'Overig', key: 'overig' },
];

const BALANCE_ROWS: { label: string; key: keyof OpeningBalanceInput; hint?: string }[] = [
  { label: 'Vaste activa', key: 'fixedAssetsCents', hint: 'Boekwaarde van bedrijfsmiddelen die je al hebt.' },
  { label: 'Afschrijving per jaar', key: 'annualDepreciationCents', hint: 'Op die bestaande bedrijfsmiddelen.' },
  { label: 'Voorraad', key: 'stockCents' },
  { label: 'Debiteuren', key: 'receivablesCents', hint: 'Facturen die nog openstaan.' },
  { label: 'Banksaldo', key: 'cashCents' },
  { label: 'Eigen vermogen', key: 'equityCents' },
  { label: 'Crediteuren', key: 'payablesCents', hint: 'Wat je nog aan leveranciers moet betalen.' },
  { label: 'Overige schulden', key: 'otherLiabilitiesCents', hint: 'Bijvoorbeeld belastingschuld. Leningen vul je in stap 5 in.' },
];

function emptyYear(year: number): HistoricalYear {
  return {
    year,
    revenueCents: 0,
    costOfSalesCents: 0,
    operatingCostsCents: {
      huur: 0,
      vervoer: 0,
      verzekeringen: 0,
      telefoon_software: 0,
      accountant: 0,
      marketing: 0,
      overig: 0,
    },
    staffCents: 0,
    depreciationCents: 0,
    interestCents: 0,
    netProfitCents: 0,
    privateWithdrawalsCents: 0,
    balance: {
      fixedAssetsCents: 0,
      stockCents: 0,
      receivablesCents: 0,
      cashCents: 0,
      equityCents: 0,
      debtCents: 0,
    },
  };
}

const EMPTY_OPENING_BALANCE: OpeningBalanceInput = {
  fixedAssetsCents: 0,
  annualDepreciationCents: 0,
  stockCents: 0,
  receivablesCents: 0,
  cashCents: 0,
  equityCents: 0,
  payablesCents: 0,
  otherLiabilitiesCents: 0,
};

export function StepHistorie() {
  const { planId, input, update } = useWizard();
  const { history, company } = input;

  if (company.isStarter) {
    return (
      <Card title="Historische cijfers" description="Als starter sla je deze stap over.">
        <Callout tone="info" title="Je hebt nog geen jaarcijfers">
          Een financier weet dat. In plaats daarvan kijkt hij extra goed naar je onderbouwing: waar komt je omzet
          vandaan, welke klanten heb je al, en wat kun je zelf inbrengen. Daar gaat stap 6 over.
        </Callout>
        <div className="mt-4">
          <Link to={`/plan/${planId}/aannames`} className="text-sm font-medium text-blue-700 underline">
            Door naar de prognose-aannames
          </Link>
        </div>
      </Card>
    );
  }

  const years = history.years;
  const openingBalance = history.openingBalance ?? EMPTY_OPENING_BALANCE;

  const setYear = (index: number, change: (year: HistoricalYear) => void) => {
    update((draft) => {
      const year = draft.history.years[index];
      if (year) change(year);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Jaarcijfers"
        description="Vul de laatste één tot drie afgesloten boekjaren in, zoals ze in je jaarrekening staan."
        actions={
          years.length < 3 ? (
            <Button
              onClick={() => {
                update((draft) => {
                  const lastYear = draft.history.years.at(-1)?.year ?? new Date().getFullYear() - 1;
                  draft.history.years.push(emptyYear(draft.history.years.length === 0 ? lastYear : lastYear - 1));
                });
              }}
            >
              Boekjaar toevoegen
            </Button>
          ) : undefined
        }
      >
        {years.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            Nog geen boekjaren. Voeg het laatst afgesloten jaar toe.
          </p>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr>
                  <th scope="col" className="w-48 px-2 pb-2 text-left text-xs font-medium text-slate-500 uppercase">
                    Post
                  </th>
                  {years.map((year, index) => (
                    <th key={year.year} scope="col" className="px-2 pb-2">
                      <div className="flex items-center gap-2">
                        <NumberInput
                          ariaLabel="Boekjaar"
                          value={year.year}
                          onChange={(value) => {
                            setYear(index, (draft) => {
                              draft.year = value;
                            });
                          }}
                        />
                        <Button
                          variant="danger"
                          className="px-2"
                          aria-label={`Verwijder boekjaar ${year.year}`}
                          onClick={() => {
                            update((draft) => {
                              draft.history.years.splice(index, 1);
                            });
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PNL_ROWS.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100">
                    <th scope="row" className="px-2 py-1.5 text-left font-normal text-slate-700">
                      {row.label}
                    </th>
                    {years.map((year, index) => (
                      <td key={year.year} className="px-2 py-1">
                        <MoneyInput
                          ariaLabel={`${row.label} ${year.year}`}
                          value={year[row.key]}
                          onChange={(value) => {
                            setYear(index, (draft) => {
                              draft[row.key] = value;
                            });
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th colSpan={years.length + 1} scope="col" className="px-2 pt-4 pb-1 text-left text-xs font-medium text-slate-500 uppercase">
                    Bedrijfskosten
                  </th>
                </tr>
                {COST_ROWS.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100">
                    <th scope="row" className="px-2 py-1.5 text-left font-normal text-slate-700">
                      {row.label}
                    </th>
                    {years.map((year, index) => (
                      <td key={year.year} className="px-2 py-1">
                        <MoneyInput
                          ariaLabel={`${row.label} ${year.year}`}
                          value={year.operatingCostsCents[row.key]}
                          onChange={(value) => {
                            setYear(index, (draft) => {
                              draft.operatingCostsCents[row.key] = value;
                            });
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Balans op de startdatum"
        description="Hoe je er staat op het moment dat de prognose begint. Voorgevuld vanuit je laatste jaarbalans, maar pas het gerust aan."
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BALANCE_ROWS.map((row) => (
            <Field key={row.key} label={row.label} hint={row.hint}>
              {({ id, describedBy }) => (
                <MoneyInput
                  id={id}
                  describedBy={describedBy}
                  value={openingBalance[row.key]}
                  onChange={(value) => {
                    update((draft) => {
                      const balance = draft.history.openingBalance ?? { ...EMPTY_OPENING_BALANCE };
                      balance[row.key] = value;
                      draft.history.openingBalance = balance;
                    });
                  }}
                />
              )}
            </Field>
          ))}
        </div>
        <BalanceCheck balance={openingBalance} existingDebt={sumExistingDebt(input.financing.existingDebts)} />
      </Card>
    </div>
  );
}

function sumExistingDebt(debts: readonly { outstandingCents: Cents }[]): Cents {
  return debts.reduce((total, debt) => total + debt.outstandingCents, 0);
}

function BalanceCheck({ balance, existingDebt }: { balance: OpeningBalanceInput; existingDebt: Cents }) {
  const assets = balance.fixedAssetsCents + balance.stockCents + balance.receivablesCents + balance.cashCents;
  const liabilities = balance.equityCents + existingDebt + balance.payablesCents + balance.otherLiabilitiesCents;
  const difference = assets - liabilities;
  if (difference === 0) return null;

  return (
    <div className="mt-4">
      <Callout tone="warning" title="De balans sluit nog niet">
        Er zit een verschil van {formatCents(difference)} tussen je bezittingen en je schulden plus eigen vermogen. We rekenen gewoon door en zetten het verschil bij de
        overige schulden, maar een financier zal ernaar vragen.
      </Callout>
    </div>
  );
}
