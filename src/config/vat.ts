import type { Bp, FixedCostCategory, VatRateShare } from '../engine/types/input';

export const VAT_RATE_HIGH: Bp = 2100;
export const VAT_RATE_LOW: Bp = 900;
export const VAT_RATE_NONE: Bp = 0;

/** Standaard: alle omzet belast met het hoge tarief. */
export const DEFAULT_REVENUE_VAT_MIX: readonly VatRateShare[] = [{ rateBp: VAT_RATE_HIGH, shareBp: 10_000 }];

/** Voorbelasting per kostensoort. Verzekeringen zijn vrijgesteld; loon kent geen btw. */
export const DEFAULT_COST_VAT_RATES: Record<FixedCostCategory, Bp> = {
  huur: VAT_RATE_HIGH,
  vervoer: VAT_RATE_HIGH,
  verzekeringen: VAT_RATE_NONE,
  telefoon_software: VAT_RATE_HIGH,
  accountant: VAT_RATE_HIGH,
  marketing: VAT_RATE_HIGH,
  overig: VAT_RATE_HIGH,
};
