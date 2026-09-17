import { z } from 'zod';
import type { FinancingNeedInput } from '../engine';
import { bpSchema, centsSchema, monthIndexSchema, type AssertAssignable } from './shared';

export const investmentSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().trim().min(1, 'Geef de investering een naam').max(120),
    category: z.enum(['bedrijfsmiddel', 'verbouwing', 'voorraad', 'immaterieel', 'overig']),
    amountCents: centsSchema,
    vatRateBp: bpSchema.max(3000),
    lifeYears: z.number().int().min(1, 'Minstens één jaar').max(40, 'Hooguit veertig jaar').nullable(),
    residualValueCents: centsSchema,
    purchaseMonth: monthIndexSchema,
  })
  .refine((item) => item.residualValueCents <= item.amountCents, {
    message: 'De restwaarde kan niet hoger zijn dan de aanschafprijs',
    path: ['residualValueCents'],
  });

export const oneOffCostSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(1, 'Geef de kostenpost een naam').max(120),
  amountCents: centsSchema,
  vatRateBp: bpSchema.max(3000),
  month: monthIndexSchema,
});

export const grantSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(1, 'Geef de bron een naam').max(120),
  amountCents: centsSchema,
  month: monthIndexSchema,
});

export const needSchema = z.object({
  investments: z.array(investmentSchema),
  workingCapitalCents: centsSchema,
  oneOffCosts: z.array(oneOffCostSchema),
  ownContributionCents: centsSchema,
  grants: z.array(grantSchema),
});

export type NeedForm = AssertAssignable<FinancingNeedInput, z.infer<typeof needSchema>>;
