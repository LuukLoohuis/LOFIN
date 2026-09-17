import type { Bp, Cents, FinancierType, LegalForm } from './input';

/** Hoger is beter: onder `orangeFrom` rood, onder `greenFrom` oranje, anders groen. */
export interface HigherIsBetterBands {
  orangeFrom: number;
  greenFrom: number;
}

/** Lager is beter: tot en met `greenMax` groen, tot en met `orangeMax` oranje, anders rood. */
export interface LowerIsBetterBands {
  greenMax: number;
  orangeMax: number;
}

export interface TaxBracket {
  /** Bovengrens van de schijf; null = geen bovengrens. */
  upToCents: Cents | null;
  rateBp: Bp;
}

export interface ChecklistItemConfig {
  id: string;
  label: string;
  description: string;
  required: boolean;
  financierTypes: readonly FinancierType[] | 'alle';
  legalForms: readonly LegalForm[] | 'alle';
  stage: 'starter' | 'bestaand' | 'alle';
}

export interface EngineConfig {
  /** Rekenmaand voor betaaltermijnen. */
  daysPerMonth: number;
  /** Omzetmodel 'maandbedrag': zo lang groeit de omzet per maand. */
  revenueRampUpMonths: number;
  ratios: {
    dscr: HigherIsBetterBands;
    solvency: HigherIsBetterBands;
    /** Schuld als veelvoud van de kasstroom (jaren). */
    debtToCashflow: LowerIsBetterBands;
  };
  corporateTaxBrackets: readonly TaxBracket[];
  checklist: readonly ChecklistItemConfig[];
  completeness: { explanationMinChars: number };
}
