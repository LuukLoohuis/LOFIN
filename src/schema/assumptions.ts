import { z } from 'zod';
import { validateSeasonality, type AssumptionsInput } from '../engine';
import { bpSchema, centsSchema, daysSchema, monthIndexSchema, yearMonthSchema, type AssertAssignable } from './shared';

export const revenueModelSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('uurtarief'),
    hourlyRateCents: centsSchema,
    billableHoursPerMonth: z.number().min(0).max(400, 'Meer dan 400 uur per maand is niet haalbaar'),
  }),
  z.object({
    kind: z.literal('opdrachten'),
    jobsPerMonth: z.number().min(0).max(10_000),
    averageJobValueCents: centsSchema,
  }),
  z.object({
    kind: z.literal('maandbedrag'),
    monthlyAmountCents: centsSchema,
    monthlyGrowthBp: bpSchema.max(2000, 'Meer dan 20% groei per maand is niet vol te houden'),
  }),
]);

export const fixedCostLineSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['huur', 'vervoer', 'verzekeringen', 'telefoon_software', 'accountant', 'marketing', 'overig']),
  description: z.string().trim().min(1, 'Geef de kostenpost een naam').max(120),
  amountCents: centsSchema,
  per: z.enum(['maand', 'jaar']),
  vatRateBp: bpSchema.max(3000),
});

export const staffLineSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().trim().min(1, 'Geef de functie een naam').max(120),
    grossMonthlyCents: centsSchema,
    employerCostBp: bpSchema.max(10_000, 'Werkgeverslasten boven 100% kloppen niet'),
    startMonth: monthIndexSchema,
    endMonth: monthIndexSchema.nullable(),
  })
  .refine((line) => line.endMonth === null || line.endMonth >= line.startMonth, {
    message: 'De einddatum ligt vóór de startdatum',
    path: ['endMonth'],
  });

const growthSchema = z.object({
  y2: z.number().int().min(-10_000, 'Een krimp van meer dan 100% kan niet').max(20_000),
  y3: z.number().int().min(-10_000, 'Een krimp van meer dan 100% kan niet').max(20_000),
});

export const assumptionsSchema = z.object({
  startMonth: yearMonthSchema,
  revenue: revenueModelSchema,
  seasonality: z
    .array(z.number().int('Gebruik hele honderdsten').min(0))
    .length(12, 'Vul twaalf maanden in')
    .superRefine((weights, ctx) => {
      if (validateSeasonality(weights) !== null) {
        ctx.addIssue({ code: 'custom', message: 'De twaalf maanden moeten samen op 12,00 uitkomen' });
      }
    }),
  costOfSalesBp: bpSchema.max(10_000, 'De inkoopwaarde kan niet meer dan 100% van de omzet zijn'),
  costOfSalesVatRateBp: bpSchema.max(3000),
  fixedCosts: z.array(fixedCostLineSchema),
  staff: z.array(staffLineSchema),
  privateWithdrawalsMonthlyCents: centsSchema,
  dividendCents: z.object({ y1: centsSchema, y2: centsSchema, y3: centsSchema }),
  debtorDays: daysSchema,
  creditorDays: daysSchema,
  vat: z.object({
    revenueRates: z
      .array(z.object({ rateBp: bpSchema.max(3000), shareBp: bpSchema.max(10_000) }))
      .min(1, 'Kies minstens één btw-tarief')
      .refine((rates) => rates.reduce((total, rate) => total + rate.shareBp, 0) === 10_000, {
        message: 'De aandelen moeten samen 100% zijn',
      }),
    filing: z.enum(['maand', 'kwartaal']),
  }),
  revenueGrowthBp: growthSchema,
  costGrowthBp: growthSchema,
  minimumCashBufferCents: centsSchema,
});

export type AssumptionsForm = AssertAssignable<AssumptionsInput, z.infer<typeof assumptionsSchema>>;
