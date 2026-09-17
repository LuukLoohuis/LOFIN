import { z } from 'zod';
import type { CompanyInput } from '../engine';
import type { AssertAssignable } from './shared';

/**
 * Alleen wat een financier nodig heeft. Nooit een bsn, rekeningnummer of bankinloggegevens:
 * het KvK-nummer wordt alleen op vorm gecontroleerd, er gaat geen verzoek naar de KvK.
 */
export const companySchema = z.object({
  legalForm: z.enum(['eenmanszaak', 'vof', 'bv']),
  name: z.string().trim().min(2, 'Vul de naam van je onderneming in').max(120),
  kvkNumber: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'Een KvK-nummer bestaat uit acht cijfers')
    .or(z.literal('')),
  sectorId: z.string().min(1, 'Kies een branche'),
  foundedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Gebruik een datum zoals 2026-09-01')
    .nullable(),
  isStarter: z.boolean(),
  ownerCount: z.number().int().min(1, 'Er is minstens één eigenaar').max(20),
  description: z.string().trim().max(2000),
});

export type CompanyForm = AssertAssignable<CompanyInput, z.infer<typeof companySchema>>;
