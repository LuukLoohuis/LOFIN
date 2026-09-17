import { z } from 'zod';
import type { PlanInput } from '../engine';
import { assumptionsSchema } from './assumptions';
import { companySchema } from './company';
import { financingSchema } from './financing';
import { historySchema } from './history';
import { needSchema } from './need';
import { signedCentsSchema, type AssertAssignable } from './shared';

export const explanationsSchema = z.object({
  ondernemer: z.string().max(4000),
  markt: z.string().max(4000),
  investering: z.string().max(4000),
  opbrengst: z.string().max(4000),
  risicos: z.string().max(4000),
  zekerheden: z.string().max(4000),
});

export const scenarioSettingsSchema = z.object({
  pessimisticRevenueBp: signedCentsSchema.min(-10_000).max(0, 'Een pessimistisch scenario gaat omlaag'),
  optimisticRevenueBp: signedCentsSchema.min(0, 'Een optimistisch scenario gaat omhoog').max(10_000),
});

export const planInputSchema = z.object({
  company: companySchema,
  need: needSchema,
  history: historySchema,
  assumptions: assumptionsSchema,
  financing: financingSchema,
  explanations: explanationsSchema,
  scenarios: scenarioSettingsSchema,
  documents: z.record(z.string(), z.enum(['heb_ik', 'nog_regelen'])),
});

export type PlanInputForm = AssertAssignable<PlanInput, z.infer<typeof planInputSchema>>;

export const WIZARD_STEPS = [
  { step: 1, slug: 'onderneming', title: 'Onderneming', schema: companySchema, section: 'company' },
  { step: 2, slug: 'financieringsbehoefte', title: 'Financieringsbehoefte', schema: needSchema, section: 'need' },
  { step: 3, slug: 'historie', title: 'Historische cijfers', schema: historySchema, section: 'history' },
  { step: 4, slug: 'aannames', title: 'Prognose-aannames', schema: assumptionsSchema, section: 'assumptions' },
  { step: 5, slug: 'financiering', title: 'Financiering', schema: financingSchema, section: 'financing' },
  { step: 6, slug: 'toelichting', title: 'Toelichting', schema: explanationsSchema, section: 'explanations' },
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];
export type WizardSection = WizardStep['section'];

/** Welke stappen zijn af? Een stap telt als af zodra zijn eigen schema hem goedkeurt. */
export function validateStep(step: WizardStep, plan: PlanInput): z.ZodError | null {
  const result = step.schema.safeParse(plan[step.section]);
  return result.success ? null : result.error;
}
