import { create } from 'zustand';
import {
  ENGINE_VERSION,
  latestVersion,
  metricSeriesFromResult,
  type ActualMonth,
  type ForecastSnapshot,
  type PlanInput,
  type PlanResult,
} from '../engine';
import { createId } from '../lib/id';
import { supabase } from '../lib/supabase';
import { createDefaultPlanInput, nextMonth } from './defaultPlan';
import { browserStorage, createLocalPlanRepository, type PlanRepository, type PlanSummary, type StoredPlan } from './planRepository';
import { createSupabasePlanRepository, migrateLocalPlans } from './supabaseRepository';

export type SaveStatus = 'leeg' | 'opgeslagen' | 'bezig' | 'fout';

const AUTOSAVE_DELAY_MS = 800;

interface PlanState {
  repository: PlanRepository;
  /** null = als gast, in deze browser. */
  userId: string | null;
  movedPlans: number;
  plan: StoredPlan | null;
  status: SaveStatus;
  loading: boolean;
  /** Vastgezette prognoses en de ingevoerde realisatie van het geopende plan. */
  versions: ForecastSnapshot[];
  actuals: ActualMonth[];
  /** Schakelt tussen opslag in de browser en opslag in je account. */
  useAccount: (userId: string | null) => Promise<void>;
  lockVersion: (params: {
    kind: ForecastSnapshot['kind'];
    note: string | null;
    result: PlanResult;
    today: string;
  }) => Promise<void>;
  saveActualMonth: (month: ActualMonth) => Promise<void>;
  importActualMonths: (months: readonly ActualMonth[]) => Promise<void>;
  createPlan: (name: string) => Promise<StoredPlan>;
  loadPlan: (id: string) => Promise<void>;
  rename: (name: string) => void;
  /** Past het plan aan op een kopie en bewaart het even later vanzelf. */
  update: (recipe: (draft: PlanInput) => void) => void;
  listPlans: () => Promise<PlanSummary[]>;
  removePlan: (id: string) => Promise<void>;
  flush: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const usePlanStore = create<PlanState>((set, get) => {
  const scheduleSave = () => {
    if (saveTimer !== null) clearTimeout(saveTimer);
    set({ status: 'bezig' });
    saveTimer = setTimeout(() => {
      void get().flush();
    }, AUTOSAVE_DELAY_MS);
  };

  const localRepository = createLocalPlanRepository(browserStorage());

  return {
    repository: localRepository,
    userId: null,
    movedPlans: 0,
    plan: null,
    status: 'leeg',
    loading: false,
    versions: [],
    actuals: [],

    useAccount: async (userId) => {
      if (get().userId === userId) return;
      if (userId === null) {
        set({ userId: null, repository: localRepository, plan: null, status: 'leeg' });
        return;
      }
      const client = supabase;
      if (client === null) return;
      const remote = createSupabasePlanRepository(client, userId);
      // Wat je als gast maakte, verhuist mee naar je account.
      const moved = await migrateLocalPlans(localRepository, remote).catch(() => 0);
      set({ userId, repository: remote, movedPlans: moved, plan: null, status: 'leeg', versions: [], actuals: [] });
    },

    lockVersion: async ({ kind, note, result, today }) => {
      const plan = get().plan;
      if (plan === null) return;
      const versions = get().versions;
      const snapshot: ForecastSnapshot = {
        id: createId('versie'),
        versionNo: (latestVersion(versions)?.versionNo ?? 0) + 1,
        kind,
        createdOn: today,
        note,
        engineVersion: ENGINE_VERSION,
        startMonth: plan.input.assumptions.startMonth,
        series: metricSeriesFromResult(result),
      };
      await get().repository.addVersion(plan.id, snapshot);
      set({ versions: [...versions, snapshot] });
    },

    saveActualMonth: async (month) => {
      const plan = get().plan;
      if (plan === null) return;
      await get().repository.saveActualMonth(plan.id, month);
      const others = get().actuals.filter((candidate) => candidate.month !== month.month);
      set({ actuals: [...others, month].sort((left, right) => left.month - right.month) });
    },

    importActualMonths: async (months) => {
      for (const month of months) await get().saveActualMonth(month);
    },

    createPlan: async (name) => {
      const now = new Date().toISOString();
      const plan: StoredPlan = {
        id: createId('plan'),
        name: name.trim() === '' ? 'Naamloos plan' : name.trim(),
        createdAt: now,
        updatedAt: now,
        input: createDefaultPlanInput(nextMonth(new Date())),
      };
      await get().repository.save(plan);
      set({ plan, status: 'opgeslagen' });
      return plan;
    },

    loadPlan: async (id) => {
      if (get().plan?.id === id) return;
      set({ loading: true });
      const plan = await get().repository.load(id);
      if (plan === null) {
        set({ plan: null, loading: false, status: 'leeg', versions: [], actuals: [] });
        return;
      }
      const [versions, actuals] = await Promise.all([
        get().repository.listVersions(id),
        get().repository.listActuals(id),
      ]);
      set({ plan, versions, actuals, loading: false, status: 'opgeslagen' });
    },

    rename: (name) => {
      const current = get().plan;
      if (current === null) return;
      set({ plan: { ...current, name, updatedAt: new Date().toISOString() } });
      scheduleSave();
    },

    update: (recipe) => {
      const current = get().plan;
      if (current === null) return;
      const input = structuredClone(current.input);
      recipe(input);
      set({ plan: { ...current, input, updatedAt: new Date().toISOString() } });
      scheduleSave();
    },

    listPlans: () => get().repository.list(),

    removePlan: async (id) => {
      await get().repository.remove(id);
      if (get().plan?.id === id) set({ plan: null, status: 'leeg' });
    },

    flush: async () => {
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      const plan = get().plan;
      if (plan === null) return;
      try {
        await get().repository.save(plan);
        set({ status: 'opgeslagen' });
      } catch {
        set({ status: 'fout' });
      }
    },
  };
});
