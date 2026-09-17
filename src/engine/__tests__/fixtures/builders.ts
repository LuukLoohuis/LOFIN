import { DEFAULT_REVENUE_VAT_MIX, VAT_RATE_HIGH } from '../../../config/vat';
import type { PlanInput } from '../../types/input';

/** Leeg startpunt: eenmanszaak, start januari 2027, geen omzet en geen kosten. */
export function emptyPlan(): PlanInput {
  return {
    company: {
      legalForm: 'eenmanszaak',
      name: 'Testbedrijf',
      kvkNumber: '12345678',
      sectorId: 'overig',
      foundedOn: null,
      isStarter: true,
      ownerCount: 1,
      description: 'Testomschrijving',
    },
    need: {
      investments: [],
      workingCapitalCents: 0,
      oneOffCosts: [],
      ownContributionCents: 0,
      grants: [],
    },
    history: { years: [], openingBalance: null },
    assumptions: {
      startMonth: '2027-01',
      revenue: { kind: 'maandbedrag', monthlyAmountCents: 0, monthlyGrowthBp: 0 },
      seasonality: Array.from({ length: 12 }, () => 100),
      costOfSalesBp: 0,
      costOfSalesVatRateBp: VAT_RATE_HIGH,
      fixedCosts: [],
      staff: [],
      privateWithdrawalsMonthlyCents: 0,
      dividendCents: { y1: 0, y2: 0, y3: 0 },
      debtorDays: 0,
      creditorDays: 0,
      vat: { revenueRates: [...DEFAULT_REVENUE_VAT_MIX], filing: 'kwartaal' },
      revenueGrowthBp: { y2: 0, y3: 0 },
      costGrowthBp: { y2: 0, y3: 0 },
      minimumCashBufferCents: 0,
    },
    financing: { lines: [], existingDebts: [], financierTypes: [] },
    explanations: { ondernemer: '', markt: '', investering: '', opbrengst: '', risicos: '', zekerheden: '' },
    scenarios: { pessimisticRevenueBp: -2000, optimisticRevenueBp: 1000 },
    documents: {},
  };
}

export function makePlan(adjust: (draft: PlanInput) => void): PlanInput {
  const draft = emptyPlan();
  adjust(draft);
  return draft;
}
