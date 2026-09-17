import type { EngineConfig } from '../engine/types/config';
import { DOCUMENT_CHECKLIST } from './checklists';

/**
 * Alle grenswaarden staan hier, niet in de rekenkern. De stoplichten zijn indicatief:
 * elke financier weegt zelf.
 */
export const defaultEngineConfig: EngineConfig = {
  daysPerMonth: 30,
  revenueRampUpMonths: 12,
  ratios: {
    // DSCR: onder 1,0 is er te weinig kasstroom voor rente en aflossing.
    dscr: { orangeFrom: 1.0, greenFrom: 1.3 },
    solvency: { orangeFrom: 0.15, greenFrom: 0.25 },
    // Schuld gedeeld door de jaarlijkse kasstroom, in jaren.
    debtToCashflow: { greenMax: 3, orangeMax: 5 },
  },
  // Vennootschapsbelasting 2026.
  corporateTaxBrackets: [
    { upToCents: 20_000_000, rateBp: 1900 },
    { upToCents: null, rateBp: 2580 },
  ],
  checklist: DOCUMENT_CHECKLIST,
  completeness: { explanationMinChars: 80 },
};

/** Standaardscenario's: het pessimistische scenario is wat een financier zelf doorrekent. */
export const DEFAULT_SCENARIO_SETTINGS = {
  pessimisticRevenueBp: -2000,
  optimisticRevenueBp: 1000,
};
