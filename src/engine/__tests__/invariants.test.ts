import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { defaultEngineConfig } from '../../config/engine';
import { sum } from '../core/money';
import { calculatePlan } from '../plan/calculatePlan';
import type { LegalForm, PlanInput, RepaymentType, VatFiling } from '../types/input';
import { makePlan } from './fixtures/builders';

/** Twaalf gewichten die altijd samen 1200 zijn. */
const seasonality = fc
  .array(fc.integer({ min: 50, max: 100 }), { minLength: 11, maxLength: 11 })
  .map((weights) => [...weights, 1200 - sum(weights)]);

const arbitraryPlan = fc
  .record({
    legalForm: fc.constantFrom<LegalForm>('eenmanszaak', 'vof', 'bv'),
    startMonth: fc.integer({ min: 1, max: 12 }),
    monthlyRevenue: fc.integer({ min: 0, max: 5_000_000 }),
    monthlyGrowthBp: fc.integer({ min: 0, max: 300 }),
    costOfSalesBp: fc.integer({ min: 0, max: 7000 }),
    monthlyFixedCosts: fc.integer({ min: 0, max: 500_000 }),
    yearlyFixedCosts: fc.integer({ min: 0, max: 2_000_000 }),
    staffCosts: fc.integer({ min: 0, max: 400_000 }),
    withdrawals: fc.integer({ min: 0, max: 500_000 }),
    debtorDays: fc.integer({ min: 0, max: 90 }),
    creditorDays: fc.integer({ min: 0, max: 90 }),
    filing: fc.constantFrom<VatFiling>('maand', 'kwartaal'),
    seasonality,
    investment: fc.integer({ min: 0, max: 10_000_000 }),
    investmentMonth: fc.integer({ min: 0, max: 24 }),
    ownContribution: fc.integer({ min: 0, max: 5_000_000 }),
    grant: fc.integer({ min: 0, max: 1_000_000 }),
    loan: fc.integer({ min: 0, max: 10_000_000 }),
    loanRateBp: fc.integer({ min: 0, max: 1500 }),
    loanTerm: fc.integer({ min: 6, max: 120 }),
    loanGrace: fc.integer({ min: 0, max: 12 }),
    repayment: fc.constantFrom<RepaymentType>('annuitair', 'lineair', 'aflossingsvrij'),
    creditLimit: fc.integer({ min: 0, max: 2_000_000 }),
    openingCash: fc.integer({ min: 0, max: 2_000_000 }),
    openingReceivables: fc.integer({ min: 0, max: 2_000_000 }),
  })
  .map((draft): PlanInput =>
    makePlan((plan) => {
      plan.company.legalForm = draft.legalForm;
      plan.company.isStarter = draft.openingCash === 0;
      plan.assumptions.startMonth = `2027-${String(draft.startMonth).padStart(2, '0')}`;
      plan.assumptions.revenue = {
        kind: 'maandbedrag',
        monthlyAmountCents: draft.monthlyRevenue,
        monthlyGrowthBp: draft.monthlyGrowthBp,
      };
      plan.assumptions.seasonality = draft.seasonality;
      plan.assumptions.costOfSalesBp = draft.costOfSalesBp;
      plan.assumptions.fixedCosts = [
        { id: 'maand', category: 'huur', description: 'Huur', amountCents: draft.monthlyFixedCosts, per: 'maand', vatRateBp: 2100 },
        { id: 'jaar', category: 'verzekeringen', description: 'Verzekeringen', amountCents: draft.yearlyFixedCosts, per: 'jaar', vatRateBp: 0 },
      ];
      plan.assumptions.staff = [
        { id: 'team', description: 'Personeel', grossMonthlyCents: draft.staffCosts, employerCostBp: 3000, startMonth: 1, endMonth: null },
      ];
      plan.assumptions.privateWithdrawalsMonthlyCents = draft.withdrawals;
      plan.assumptions.dividendCents = { y1: 0, y2: 100_000, y3: 0 };
      plan.assumptions.debtorDays = draft.debtorDays;
      plan.assumptions.creditorDays = draft.creditorDays;
      plan.assumptions.vat.filing = draft.filing;
      plan.assumptions.revenueGrowthBp = { y2: 500, y3: -500 };
      plan.assumptions.costGrowthBp = { y2: 200, y3: 200 };

      plan.need.investments = [
        {
          id: 'investering',
          description: 'Investering',
          category: 'bedrijfsmiddel',
          amountCents: draft.investment,
          vatRateBp: 2100,
          lifeYears: 5,
          residualValueCents: 0,
          purchaseMonth: draft.investmentMonth,
        },
      ];
      plan.need.ownContributionCents = draft.ownContribution;
      plan.need.grants = [{ id: 'subsidie', description: 'Subsidie', amountCents: draft.grant, month: 1 }];
      plan.financing.lines = [
        {
          id: 'lening',
          kind: 'lening',
          description: 'Lening',
          principalCents: draft.loan,
          annualRateBp: draft.loanRateBp,
          termMonths: draft.loanTerm,
          repayment: draft.repayment,
          graceMonths: Math.min(draft.loanGrace, draft.loanTerm - 1),
          startMonth: 0,
          isRequested: true,
        },
        {
          id: 'krediet',
          kind: 'krediet',
          description: 'Rekening-courant',
          limitCents: draft.creditLimit,
          annualRateBp: 900,
          startMonth: 0,
          isRequested: true,
        },
      ];
      plan.history.openingBalance = {
        fixedAssetsCents: 0,
        annualDepreciationCents: 0,
        stockCents: 0,
        receivablesCents: draft.openingReceivables,
        cashCents: draft.openingCash,
        equityCents: draft.openingCash + draft.openingReceivables,
        payablesCents: 0,
        otherLiabilitiesCents: 0,
      };
    }),
  );

describe('doorrekening — eigenschappen', () => {
  it('houdt balans, kasstroom en periodetotalen sluitend', () => {
    fc.assert(
      fc.property(arbitraryPlan, (plan) => {
        const result = calculatePlan(plan, defaultEngineConfig);

        for (const sheet of result.balanceSheet.monthly) {
          expect(sheet.totalAssets).toBe(sheet.totalLiabilities);
        }

        result.cashflow.monthly.forEach((row, month) => {
          expect(row.closingCash).toBe(row.openingCash + row.netCashflow);
          if (month > 0) expect(row.openingCash).toBe(result.cashflow.monthly[month - 1]?.closingCash);
        });

        const monthlyRevenue = sum(result.pnl.monthly.map((row) => row.revenue));
        const periodRevenue = sum(result.pnl.periods.map((row) => row.revenue));
        expect(monthlyRevenue).toBe(periodRevenue);

        const quarterlyCash = result.cashflow.quarterly.at(-1)?.closingCash;
        expect(quarterlyCash).toBe(result.cashflow.monthly.at(-1)?.closingCash);

        for (const loan of result.loans) {
          expect(loan.rows.every((row) => row.closingBalance >= 0 && row.interest >= 0)).toBe(true);
        }
      }),
      { numRuns: 60 },
    );
  });
});
