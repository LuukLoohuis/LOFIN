import { VAT_RATE_HIGH, VAT_RATE_NONE } from '../../../config/vat';
import type { PlanInput } from '../../types/input';
import { makePlan } from './builders';

/**
 * Testcasus uit de specificatie: Loodgieter Jansen, eenmanszaak, start 1 januari 2027.
 * Investering 45.000 plus 10.000 werkkapitaal, eigen inbreng 5.000, lening 50.000 tegen 7%
 * in 60 maanden annuïtair. Omzet 150.000 per jaar, inkoopwaarde 35%, vaste kosten 20.000
 * per jaar, privé-opnamen 3.800 per maand.
 */
export const jansenPlan: PlanInput = makePlan((plan) => {
  plan.company = {
    legalForm: 'eenmanszaak',
    name: 'Loodgieter Jansen',
    kvkNumber: '87654321',
    sectorId: 'installateur',
    foundedOn: null,
    isStarter: true,
    ownerCount: 1,
    description: 'Loodgietersbedrijf voor particulieren en kleine aannemers.',
  };
  plan.need.investments = [
    {
      id: 'bus',
      description: 'Bedrijfsbus',
      category: 'bedrijfsmiddel',
      amountCents: 3_500_000,
      vatRateBp: VAT_RATE_HIGH,
      lifeYears: 5,
      residualValueCents: 0,
      purchaseMonth: 0,
    },
    {
      id: 'gereedschap',
      description: 'Gereedschap',
      category: 'bedrijfsmiddel',
      amountCents: 1_000_000,
      vatRateBp: VAT_RATE_HIGH,
      lifeYears: 5,
      residualValueCents: 0,
      purchaseMonth: 0,
    },
  ];
  plan.need.workingCapitalCents = 1_000_000;
  plan.need.ownContributionCents = 500_000;

  plan.assumptions.revenue = { kind: 'maandbedrag', monthlyAmountCents: 1_250_000, monthlyGrowthBp: 0 };
  plan.assumptions.costOfSalesBp = 3500;
  plan.assumptions.fixedCosts = [
    { id: 'vervoer', category: 'vervoer', description: 'Brandstof en onderhoud', amountCents: 600_000, per: 'jaar', vatRateBp: VAT_RATE_HIGH },
    { id: 'verzekeringen', category: 'verzekeringen', description: 'Verzekeringen', amountCents: 300_000, per: 'jaar', vatRateBp: VAT_RATE_NONE },
    { id: 'telefoon', category: 'telefoon_software', description: 'Telefoon en software', amountCents: 120_000, per: 'jaar', vatRateBp: VAT_RATE_HIGH },
    { id: 'accountant', category: 'accountant', description: 'Boekhouder', amountCents: 180_000, per: 'jaar', vatRateBp: VAT_RATE_HIGH },
    { id: 'marketing', category: 'marketing', description: 'Website en advertenties', amountCents: 200_000, per: 'jaar', vatRateBp: VAT_RATE_HIGH },
    { id: 'overig', category: 'overig', description: 'Overige kosten', amountCents: 600_000, per: 'jaar', vatRateBp: VAT_RATE_HIGH },
  ];
  plan.assumptions.privateWithdrawalsMonthlyCents = 380_000;
  plan.assumptions.debtorDays = 30;
  plan.assumptions.creditorDays = 30;

  plan.financing.lines = [
    {
      id: 'lening',
      kind: 'lening',
      description: 'Zakelijke lening',
      principalCents: 5_000_000,
      annualRateBp: 700,
      termMonths: 60,
      repayment: 'annuitair',
      graceMonths: 0,
      startMonth: 0,
      isRequested: true,
    },
  ];
  plan.financing.financierTypes = ['bank'];
});
