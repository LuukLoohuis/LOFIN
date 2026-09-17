import { describe, expect, it } from 'vitest';
import { defaultEngineConfig } from '../../config/engine';
import { calculatePlan } from '../plan/calculatePlan';
import { estimateWorkingCapital } from '../plan/financingNeed';
import { makePlan } from './fixtures/builders';
import { jansenPlan } from './fixtures/jansen';

describe('financieringsbehoefte', () => {
  it('rekent de behoefte uit de testcasus', () => {
    const { financingNeed } = calculatePlan(jansenPlan, defaultEngineConfig);
    expect(financingNeed.uses).toMatchObject({
      investments: 4_500_000,
      workingCapital: 1_000_000,
      oneOffCosts: 0,
      total: 5_500_000,
    });
    expect(financingNeed.uses.investmentsByCategory.bedrijfsmiddel).toBe(4_500_000);
    expect(financingNeed.sources).toMatchObject({
      ownContribution: 500_000,
      grants: 0,
      otherFinancing: 0,
      requestedFinancing: 5_000_000,
      total: 5_500_000,
    });
    expect(financingNeed.financingNeed).toBe(5_000_000);
    expect(financingNeed.difference).toBe(0);
  });

  it('toont de btw op investeringen als tijdelijke financieringsbehoefte', () => {
    const { financingNeed } = calculatePlan(jansenPlan, defaultEngineConfig);
    expect(financingNeed.vatOnInvestments.total).toBe(945_000);
    expect(financingNeed.vatOnInvestments.settlements).toEqual([
      { purchaseMonth: 0, vat: 945_000, settledInMonth: 4 },
    ]);
  });

  it('zet de btw-verrekening per aankoopmaand op volgorde', () => {
    const plan = makePlan((draft) => {
      draft.need.investments = [
        {
          id: 'later',
          description: 'Tweede machine',
          category: 'bedrijfsmiddel',
          amountCents: 1_000_000,
          vatRateBp: 2100,
          lifeYears: 5,
          residualValueCents: 0,
          purchaseMonth: 13,
        },
        {
          id: 'eerst',
          description: 'Eerste machine',
          category: 'bedrijfsmiddel',
          amountCents: 2_000_000,
          vatRateBp: 2100,
          lifeYears: 5,
          residualValueCents: 0,
          purchaseMonth: 0,
        },
        {
          id: 'buiten',
          description: 'Na de horizon',
          category: 'bedrijfsmiddel',
          amountCents: 500_000,
          vatRateBp: 2100,
          lifeYears: 5,
          residualValueCents: 0,
          purchaseMonth: 99,
        },
      ];
    });

    const { financingNeed } = calculatePlan(plan, defaultEngineConfig);
    expect(financingNeed.vatOnInvestments.settlements).toEqual([
      { purchaseMonth: 0, vat: 420_000, settledInMonth: 4 },
      { purchaseMonth: 13, vat: 210_000, settledInMonth: 16 },
      { purchaseMonth: 99, vat: 105_000, settledInMonth: null },
    ]);
  });

  it('trekt subsidies en overige financiering van de behoefte af', () => {
    const plan = makePlan((draft) => {
      draft.need.investments = [
        {
          id: 'machine',
          description: 'Machine',
          category: 'bedrijfsmiddel',
          amountCents: 4_000_000,
          vatRateBp: 2100,
          lifeYears: 8,
          residualValueCents: 0,
          purchaseMonth: 0,
        },
      ];
      draft.need.grants = [{ id: 'subsidie', description: 'Subsidie', amountCents: 500_000, month: 0 }];
      draft.need.ownContributionCents = 1_000_000;
      draft.financing.lines = [
        {
          id: 'familie',
          kind: 'achtergestelde_lening',
          description: 'Lening van familie',
          principalCents: 500_000,
          annualRateBp: 200,
          termMonths: 60,
          repayment: 'aflossingsvrij',
          graceMonths: 0,
          startMonth: 0,
          isRequested: false,
        },
        {
          id: 'bank',
          kind: 'lening',
          description: 'Banklening',
          principalCents: 2_000_000,
          annualRateBp: 700,
          termMonths: 60,
          repayment: 'annuitair',
          graceMonths: 0,
          startMonth: 0,
          isRequested: true,
        },
      ];
    });

    const { financingNeed, issues } = calculatePlan(plan, defaultEngineConfig);
    expect(financingNeed.financingNeed).toBe(2_000_000);
    expect(financingNeed.difference).toBe(0);
    expect(issues.some((issue) => issue.code === 'FUNDING_IMBALANCE')).toBe(false);
  });

  it('meldt het als bronnen en bestedingen niet op elkaar aansluiten', () => {
    const plan = makePlan((draft) => {
      Object.assign(draft, structuredClone(jansenPlan));
      const [line] = draft.financing.lines;
      if (line === undefined || line.kind === 'krediet') throw new Error('geen lening');
      line.principalCents = 4_000_000;
    });

    const { financingNeed, issues } = calculatePlan(plan, defaultEngineConfig);
    expect(financingNeed.difference).toBe(-1_000_000);
    expect(issues).toContainEqual({
      code: 'FUNDING_IMBALANCE',
      severity: 'error',
      path: 'financing.lines',
      params: { difference: -1_000_000, uses: 5_500_000, sources: 4_500_000 },
    });
  });

  it('telt een kredietlimiet als bron mee', () => {
    const plan = makePlan((draft) => {
      draft.need.workingCapitalCents = 1_000_000;
      draft.financing.lines = [
        {
          id: 'krediet',
          kind: 'krediet',
          description: 'Rekening-courant',
          limitCents: 1_000_000,
          annualRateBp: 900,
          startMonth: 0,
          isRequested: true,
        },
      ];
    });
    const { financingNeed } = calculatePlan(plan, defaultEngineConfig);
    expect(financingNeed.sources.requestedFinancing).toBe(1_000_000);
    expect(financingNeed.difference).toBe(0);
  });
});

describe('estimateWorkingCapital', () => {
  it('schat debiteuren plus voorraad min crediteuren', () => {
    expect(
      estimateWorkingCapital(
        {
          annualRevenueCents: 15_000_000,
          annualCostOfSalesCents: 5_250_000,
          debtorDays: 30,
          creditorDays: 30,
          stockDays: 30,
        },
        30,
      ),
    ).toBe(1_250_000);
  });

  it('wordt nooit negatief', () => {
    expect(
      estimateWorkingCapital(
        {
          annualRevenueCents: 1_000_000,
          annualCostOfSalesCents: 6_000_000,
          debtorDays: 0,
          creditorDays: 60,
          stockDays: 0,
        },
        30,
      ),
    ).toBe(0);
  });
});
