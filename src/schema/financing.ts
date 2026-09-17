import { z } from 'zod';
import type { FinancingInput } from '../engine';
import { centsSchema, monthIndexSchema, rateBpSchema, type AssertAssignable } from './shared';

const termMonthsSchema = z.number().int().min(1, 'Een looptijd van minstens één maand').max(360);

export const loanLineSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['lening', 'lease', 'achtergestelde_lening']),
    description: z.string().trim().min(1, 'Geef de financiering een naam').max(120),
    principalCents: centsSchema,
    annualRateBp: rateBpSchema,
    termMonths: termMonthsSchema,
    repayment: z.enum(['annuitair', 'lineair', 'aflossingsvrij']),
    graceMonths: z.number().int().min(0).max(360),
    startMonth: monthIndexSchema,
    isRequested: z.boolean(),
  })
  .refine((line) => line.repayment === 'aflossingsvrij' || line.graceMonths < line.termMonths, {
    message: 'De aflossingsvrije periode moet korter zijn dan de looptijd',
    path: ['graceMonths'],
  });

export const creditLineSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('krediet'),
  description: z.string().trim().min(1, 'Geef het krediet een naam').max(120),
  limitCents: centsSchema,
  annualRateBp: rateBpSchema,
  startMonth: monthIndexSchema,
  isRequested: z.boolean(),
});

export const financingLineSchema = z.union([creditLineSchema, loanLineSchema]);

export const existingDebtSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(1, 'Geef de lening een naam').max(120),
  outstandingCents: centsSchema,
  annualRateBp: rateBpSchema,
  remainingMonths: termMonthsSchema,
  repayment: z.enum(['annuitair', 'lineair', 'aflossingsvrij']),
});

export const financingSchema = z.object({
  lines: z.array(financingLineSchema),
  existingDebts: z.array(existingDebtSchema),
  /** Bepaalt welke documenten op de checklist komen. Geen namen van financiers. */
  financierTypes: z.array(
    z.enum(['bank', 'microfinancier', 'crowdfunding', 'leasemaatschappij', 'kredietunie', 'familie_vrienden']),
  ),
});

export type FinancingForm = AssertAssignable<FinancingInput, z.infer<typeof financingSchema>>;
