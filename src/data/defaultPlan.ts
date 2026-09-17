import {
  BRANCH_PRESETS,
  DEFAULT_COST_VAT_RATES,
  DEFAULT_REVENUE_VAT_MIX,
  DEFAULT_SCENARIO_SETTINGS,
  FALLBACK_BRANCH,
} from '../config';
import type { BranchPreset } from '../config';
import type { FixedCostCategory, PlanInput, RevenueModel } from '../engine';
import { createId } from '../lib/id';

const FIXED_COST_SEED: { category: FixedCostCategory; description: string }[] = [
  { category: 'huur', description: 'Huur bedrijfsruimte' },
  { category: 'vervoer', description: 'Vervoer en brandstof' },
  { category: 'verzekeringen', description: 'Verzekeringen' },
  { category: 'telefoon_software', description: 'Telefoon en software' },
  { category: 'accountant', description: 'Boekhouder' },
  { category: 'marketing', description: 'Marketing' },
  { category: 'overig', description: 'Overige kosten' },
];

export function findBranchPreset(sectorId: string): BranchPreset {
  return BRANCH_PRESETS.find((preset) => preset.id === sectorId) ?? FALLBACK_BRANCH;
}

/** Een leeg omzetmodel van het soort dat bij de branche past. */
export function emptyRevenueModel(kind: RevenueModel['kind']): RevenueModel {
  switch (kind) {
    case 'uurtarief':
      return { kind, hourlyRateCents: 0, billableHoursPerMonth: 0 };
    case 'opdrachten':
      return { kind, jobsPerMonth: 0, averageJobValueCents: 0 };
    case 'maandbedrag':
      return { kind, monthlyAmountCents: 0, monthlyGrowthBp: 0 };
  }
}

/** De eerste prognosemaand: standaard de maand na vandaag. */
export function nextMonth(today: Date): string {
  const year = today.getUTCMonth() === 11 ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
  const month = ((today.getUTCMonth() + 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function createDefaultPlanInput(startMonth: string, sectorId = 'overig'): PlanInput {
  const preset = findBranchPreset(sectorId);
  return {
    company: {
      legalForm: 'eenmanszaak',
      name: '',
      kvkNumber: '',
      sectorId: preset.id,
      foundedOn: null,
      isStarter: true,
      ownerCount: 1,
      description: '',
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
      startMonth,
      revenue: emptyRevenueModel(preset.revenueModel),
      seasonality: [...preset.seasonality],
      costOfSalesBp: preset.costOfSalesBp,
      costOfSalesVatRateBp: 2100,
      fixedCosts: FIXED_COST_SEED.map((seed) => ({
        id: createId('kost'),
        category: seed.category,
        description: seed.description,
        amountCents: 0,
        per: 'maand',
        vatRateBp: DEFAULT_COST_VAT_RATES[seed.category],
      })),
      staff: [],
      privateWithdrawalsMonthlyCents: 0,
      dividendCents: { y1: 0, y2: 0, y3: 0 },
      debtorDays: preset.debtorDays,
      creditorDays: preset.creditorDays,
      vat: { revenueRates: [...DEFAULT_REVENUE_VAT_MIX], filing: 'kwartaal' },
      revenueGrowthBp: { y2: 0, y3: 0 },
      costGrowthBp: { y2: 0, y3: 0 },
      minimumCashBufferCents: 0,
    },
    financing: { lines: [], existingDebts: [], financierTypes: [] },
    explanations: { ondernemer: '', markt: '', investering: '', opbrengst: '', risicos: '', zekerheden: '' },
    scenarios: { ...DEFAULT_SCENARIO_SETTINGS },
    documents: {},
  };
}
