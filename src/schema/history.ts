import { z } from 'zod';
import type { HistoryInput } from '../engine';
import { centsSchema, signedCentsSchema, type AssertAssignable } from './shared';

const categoryCentsSchema = z.object({
  huur: centsSchema,
  vervoer: centsSchema,
  verzekeringen: centsSchema,
  telefoon_software: centsSchema,
  accountant: centsSchema,
  marketing: centsSchema,
  overig: centsSchema,
});

export const historicalYearSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  revenueCents: centsSchema,
  costOfSalesCents: centsSchema,
  operatingCostsCents: categoryCentsSchema,
  staffCents: centsSchema,
  depreciationCents: centsSchema,
  interestCents: centsSchema,
  netProfitCents: signedCentsSchema,
  privateWithdrawalsCents: centsSchema,
  balance: z.object({
    fixedAssetsCents: centsSchema,
    stockCents: centsSchema,
    receivablesCents: centsSchema,
    cashCents: centsSchema,
    equityCents: signedCentsSchema,
    debtCents: centsSchema,
  }),
});

/** De balans op de startdatum van de prognose; voorgevuld met de laatste jaarbalans. */
export const openingBalanceSchema = z.object({
  fixedAssetsCents: centsSchema,
  annualDepreciationCents: centsSchema,
  stockCents: centsSchema,
  receivablesCents: centsSchema,
  cashCents: centsSchema,
  equityCents: signedCentsSchema,
  payablesCents: centsSchema,
  otherLiabilitiesCents: centsSchema,
});

export const historySchema = z.object({
  years: z.array(historicalYearSchema).max(3, 'Hooguit drie boekjaren'),
  openingBalance: openingBalanceSchema.nullable(),
});

export type HistoryForm = AssertAssignable<HistoryInput, z.infer<typeof historySchema>>;
