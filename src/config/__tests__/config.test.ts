import { describe, expect, it } from 'vitest';
import { validateSeasonality } from '../../engine/plan/revenue';
import { BRANCH_PRESETS } from '../branches';
import { DOCUMENT_CHECKLIST } from '../checklists';
import { defaultEngineConfig } from '../engine';
import { DEFAULT_REVENUE_VAT_MIX } from '../vat';

describe('branchevoorbeelden', () => {
  it('hebben twaalf seizoensgewichten die samen 1200 zijn', () => {
    for (const preset of BRANCH_PRESETS) {
      expect(validateSeasonality(preset.seasonality), preset.id).toBeNull();
    }
  });

  it('hebben unieke ids en een plausibele inkoopwaarde', () => {
    const ids = BRANCH_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(BRANCH_PRESETS.every((preset) => preset.costOfSalesBp >= 0 && preset.costOfSalesBp < 10_000)).toBe(true);
  });
});

describe('documentenchecklist', () => {
  it('heeft unieke ids', () => {
    const ids = DOCUMENT_CHECKLIST.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('noemt geen enkele financier bij naam', () => {
    const text = JSON.stringify(DOCUMENT_CHECKLIST);
    // Woordgrenzen, anders struikelt 'ing' over 'financiering'.
    const lenders = /\b(rabobank|abn\s?amro|ing|qredits|knab|triodos|bunq|sns|collin|funding\s?circle)\b/i;
    expect(lenders.test(text)).toBe(false);
  });
});

describe('rekenconfiguratie', () => {
  it('heeft oplopende stoplichtgrenzen', () => {
    const { dscr, solvency, debtToCashflow } = defaultEngineConfig.ratios;
    expect(dscr.orangeFrom).toBeLessThan(dscr.greenFrom);
    expect(solvency.orangeFrom).toBeLessThan(solvency.greenFrom);
    expect(debtToCashflow.greenMax).toBeLessThan(debtToCashflow.orangeMax);
  });

  it('heeft een sluitende schijvenreeks voor de vpb', () => {
    const brackets = defaultEngineConfig.corporateTaxBrackets;
    expect(brackets.at(-1)?.upToCents).toBeNull();
    expect(brackets.every((bracket) => bracket.rateBp > 0)).toBe(true);
  });

  it('verdeelt de omzet-btw over 100%', () => {
    expect(DEFAULT_REVENUE_VAT_MIX.reduce((total, rate) => total + rate.shareBp, 0)).toBe(10_000);
  });
});
