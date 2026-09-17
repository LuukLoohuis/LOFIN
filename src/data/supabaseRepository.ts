import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanInput } from '../engine';
import { createDefaultPlanInput } from './defaultPlan';
import type { PlanRepository, PlanSummary } from './planRepository';

/** De wizardstappen staan als losse rijen in plan_inputs; zo kan één stap apart bewaren. */
const SECTIONS = [
  'company',
  'need',
  'history',
  'assumptions',
  'financing',
  'explanations',
  'scenarios',
  'documents',
] as const;

type Section = (typeof SECTIONS)[number];

interface PlanRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface InputRow {
  step: string;
  data: unknown;
}

/**
 * Opslag in Supabase. Row level security zorgt ervoor dat je alleen je eigen plannen ziet;
 * deze code vertrouwt daarop en filtert daarnaast zelf op gebruiker.
 */
export function createSupabasePlanRepository(client: SupabaseClient, userId: string): PlanRepository {
  return {
    list: async () => {
      const { data, error } = await client
        .from('plans')
        .select('id, name, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .overrideTypes<{ id: string; name: string; updated_at: string }[], { merge: false }>();
      if (error !== null) throw new Error(error.message);
      return data.map((row): PlanSummary => ({ id: row.id, name: row.name, updatedAt: row.updated_at }));
    },

    load: async (id) => {
      const { data: plan, error } = await client
        .from('plans')
        .select('id, name, created_at, updated_at')
        .eq('id', id)
        .maybeSingle<PlanRow>();
      if (error !== null) throw new Error(error.message);
      if (plan === null) return null;

      const { data: inputs, error: inputError } = await client
        .from('plan_inputs')
        .select('step, data')
        .eq('plan_id', id)
        .overrideTypes<InputRow[], { merge: false }>();
      if (inputError !== null) throw new Error(inputError.message);

      return {
        id: plan.id,
        name: plan.name,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
        input: assembleInput(inputs),
      };
    },

    save: async (plan) => {
      const input = plan.input;
      const { error } = await client.from('plans').upsert({
        id: plan.id,
        user_id: userId,
        name: plan.name,
        legal_form: input.company.legalForm,
        sector: input.company.sectorId,
        created_at: plan.createdAt,
        updated_at: plan.updatedAt,
      });
      if (error !== null) throw new Error(error.message);

      const rows = SECTIONS.map((section) => ({
        plan_id: plan.id,
        step: section,
        data: input[section],
        updated_at: plan.updatedAt,
      }));
      const { error: inputError } = await client.from('plan_inputs').upsert(rows, { onConflict: 'plan_id,step' });
      if (inputError !== null) throw new Error(inputError.message);
    },

    remove: async (id) => {
      const { error } = await client.from('plans').delete().eq('id', id);
      if (error !== null) throw new Error(error.message);
    },
  };
}

/** Ontbrekende stappen vallen terug op de standaardwaarden, zodat oude plannen blijven werken. */
function assembleInput(rows: readonly InputRow[]): PlanInput {
  const input: Record<string, unknown> = { ...createDefaultPlanInput('2027-01') };
  for (const row of rows) {
    // De inhoud komt uit onze eigen schema's; zod controleert hem opnieuw in de wizard.
    if (isSection(row.step)) input[row.step] = row.data;
  }
  return input as unknown as PlanInput;
}

function isSection(step: string): step is Section {
  return (SECTIONS as readonly string[]).includes(step);
}

/**
 * Plannen die je als gast maakte, verhuizen mee naar je account. Daarna staan ze niet meer
 * alleen in deze browser.
 */
export async function migrateLocalPlans(local: PlanRepository, remote: PlanRepository): Promise<number> {
  const summaries = await local.list();
  let moved = 0;
  for (const summary of summaries) {
    const plan = await local.load(summary.id);
    if (plan === null) continue;
    await remote.save(plan);
    await local.remove(plan.id);
    moved += 1;
  }
  return moved;
}
