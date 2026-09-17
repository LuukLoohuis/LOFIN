import { z } from 'zod';

/** Bedragen zijn hele centen; de invoervelden rekenen euro's om. */
export const centsSchema = z.number().int('Gebruik hele centen').min(0, 'Dit bedrag kan niet negatief zijn');
export const signedCentsSchema = z.number().int('Gebruik hele centen');
/** Percentages zijn basispunten: 700 = 7,00%. */
export const bpSchema = z.number().int().min(0, 'Een percentage kan hier niet negatief zijn');
export const rateBpSchema = bpSchema.max(5000, 'Een rente boven 50% klopt zelden');
export const monthIndexSchema = z.number().int().min(0, 'Kies een maand binnen de prognose').max(47);
export const daysSchema = z.number().int().min(0).max(365, 'Meer dan een jaar betaaltermijn kan niet');
export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Kies een maand, bijvoorbeeld 2027-01');

/** Compileercontrole: het schema moet precies op het type van de rekenkern passen. */
export type AssertAssignable<Target, Source extends Target> = Source;
