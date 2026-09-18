import type { SupabaseClient } from '@supabase/supabase-js';
import { addMonths, parseYearMonth, type ActualMonth, type ForecastSnapshot, type PlanInput } from '../engine';
import { createDefaultPlanInput } from './defaultPlan';
import type { ImportMapping, PlanRepository, PlanSummary } from './planRepository';

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

    listVersions: async (planId) => {
      const { data, error } = await client
        .from('plan_versions')
        .select('id, version_no, kind, note, snapshot, created_at')
        .eq('plan_id', planId)
        .order('version_no', { ascending: true })
        .overrideTypes<VersionRow[], { merge: false }>();
      if (error !== null) throw new Error(error.message);
      return data.map(toSnapshot);
    },

    addVersion: async (planId, snapshot) => {
      const { error } = await client.from('plan_versions').insert({
        plan_id: planId,
        version_no: snapshot.versionNo,
        kind: snapshot.kind,
        note: snapshot.note,
        snapshot: {
          createdOn: snapshot.createdOn,
          engineVersion: snapshot.engineVersion,
          startMonth: snapshot.startMonth,
          series: snapshot.series,
        },
      });
      if (error !== null) throw new Error(error.message);
    },

    listActuals: async (planId) => {
      const { data: plan, error: planError } = await client
        .from('plan_inputs')
        .select('data')
        .eq('plan_id', planId)
        .eq('step', 'assumptions')
        .maybeSingle<{ data: { startMonth: string } }>();
      if (planError !== null) throw new Error(planError.message);
      const startMonth = plan === null ? '2027-01' : plan.data.startMonth;

      const { data, error } = await client
        .from('actuals')
        .select('month, category, amount_cents, status, source')
        .eq('plan_id', planId)
        .overrideTypes<ActualRow[], { merge: false }>();
      if (error !== null) throw new Error(error.message);
      return groupActuals(data, startMonth);
    },

    saveActualMonth: async (planId, month) => {
      const { data: plan, error: planError } = await client
        .from('plan_inputs')
        .select('data')
        .eq('plan_id', planId)
        .eq('step', 'assumptions')
        .maybeSingle<{ data: { startMonth: string } }>();
      if (planError !== null) throw new Error(planError.message);
      const startMonth = plan === null ? '2027-01' : plan.data.startMonth;

      const rows = Object.entries(month.values).map(([category, amount]) => ({
        plan_id: planId,
        month: monthToDate(startMonth, month.month),
        category,
        amount_cents: amount,
        status: month.status,
        source: month.source === 'csv' ? 'csv' : 'manual',
      }));
      if (rows.length === 0) return;

      const { error } = await client.from('actuals').upsert(rows, { onConflict: 'plan_id,month,category' });
      if (error !== null) throw new Error(error.message);
    },

    listMappings: async () => {
      const { data, error } = await client
        .from('import_mappings')
        .select('id, name, mapping')
        .eq('user_id', userId)
        .overrideTypes<ImportMapping[], { merge: false }>();
      if (error !== null) throw new Error(error.message);
      return data;
    },

    saveMapping: async (mapping) => {
      const { error } = await client
        .from('import_mappings')
        .upsert({ id: mapping.id, user_id: userId, name: mapping.name, mapping: mapping.mapping });
      if (error !== null) throw new Error(error.message);
    },
  };
}

interface VersionRow {
  id: string;
  version_no: number;
  kind: 'baseline' | 'reforecast';
  note: string | null;
  created_at: string;
  snapshot: { createdOn: string; engineVersion: string; startMonth: string; series: ForecastSnapshot['series'] };
}

interface ActualRow {
  month: string;
  category: string;
  amount_cents: number;
  status: 'open' | 'afgesloten';
  source: 'manual' | 'csv';
}

function toSnapshot(row: VersionRow): ForecastSnapshot {
  return {
    id: row.id,
    versionNo: row.version_no,
    kind: row.kind,
    note: row.note,
    createdOn: row.snapshot.createdOn,
    engineVersion: row.snapshot.engineVersion,
    startMonth: row.snapshot.startMonth,
    series: row.snapshot.series,
  };
}

/** Prognosemaand 1 is de startmaand; in de database staat een echte datum. */
export function monthToDate(startMonth: string, month: number): string {
  const start = parseYearMonth(startMonth);
  if (start === null) throw new Error(`Ongeldige startmaand: ${startMonth}`);
  const target = addMonths(start, Math.max(0, month - 1));
  return `${target.year}-${String(target.month).padStart(2, '0')}-01`;
}

export function dateToMonth(startMonth: string, date: string): number {
  const start = parseYearMonth(startMonth);
  const value = parseYearMonth(date.slice(0, 7));
  if (start === null || value === null) return 0;
  return (value.year - start.year) * 12 + (value.month - start.month) + 1;
}

function groupActuals(rows: readonly ActualRow[], startMonth: string): ActualMonth[] {
  const months = new Map<number, ActualMonth>();
  for (const row of rows) {
    const month = dateToMonth(startMonth, row.month);
    const existing = months.get(month) ?? {
      month,
      status: row.status,
      source: row.source === 'csv' ? ('csv' as const) : ('handmatig' as const),
      values: {},
    };
    months.set(month, {
      ...existing,
      status: row.status,
      values: { ...existing.values, [row.category]: row.amount_cents },
    });
  }
  return [...months.values()].sort((left, right) => left.month - right.month);
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
