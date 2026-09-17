import { create } from 'zustand';
import type { PlanInput } from '../engine';
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
  /** Schakelt tussen opslag in de browser en opslag in je account. */
  useAccount: (userId: string | null) => Promise<void>;
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
      set({ userId, repository: remote, movedPlans: moved, plan: null, status: 'leeg' });
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
      set({ plan, loading: false, status: plan === null ? 'leeg' : 'opgeslagen' });
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
