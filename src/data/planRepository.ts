import type { PlanInput } from '../engine';

export interface StoredPlan {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  input: PlanInput;
}

export interface PlanSummary {
  id: string;
  name: string;
  updatedAt: string;
}

/**
 * Waar een plan wordt bewaard. Zolang iemand nog geen account heeft, is dat de browser;
 * vanaf fase 5 komt daar Supabase bij, met dezelfde methodes.
 */
export interface PlanRepository {
  list(): Promise<PlanSummary[]>;
  load(id: string): Promise<StoredPlan | null>;
  save(plan: StoredPlan): Promise<void>;
  remove(id: string): Promise<void>;
}

const PREFIX = 'lofin.plan.';
const INDEX_KEY = 'lofin.plans';

/** Opslag in de browser. Werkt ook als de browser opslag weigert: dan is er simpelweg niets bewaard. */
export function createLocalPlanRepository(storage: Storage): PlanRepository {
  const readIndex = (): PlanSummary[] => {
    const raw = storage.getItem(INDEX_KEY);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PlanSummary[]) : [];
    } catch {
      return [];
    }
  };

  const writeIndex = (summaries: PlanSummary[]) => {
    storage.setItem(INDEX_KEY, JSON.stringify(summaries));
  };

  return {
    list: () => Promise.resolve(readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),

    load: (id) => {
      const raw = storage.getItem(PREFIX + id);
      if (raw === null) return Promise.resolve(null);
      try {
        return Promise.resolve(JSON.parse(raw) as StoredPlan);
      } catch {
        return Promise.resolve(null);
      }
    },

    save: (plan) => {
      storage.setItem(PREFIX + plan.id, JSON.stringify(plan));
      const others = readIndex().filter((summary) => summary.id !== plan.id);
      writeIndex([...others, { id: plan.id, name: plan.name, updatedAt: plan.updatedAt }]);
      return Promise.resolve();
    },

    remove: (id) => {
      storage.removeItem(PREFIX + id);
      writeIndex(readIndex().filter((summary) => summary.id !== id));
      return Promise.resolve();
    },
  };
}

/** Als de browser geen opslag toestaat (privémodus), werkt de wizard zonder te bewaren. */
export function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => {
      values.clear();
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

export function browserStorage(): Storage {
  try {
    const probe = 'lofin.probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return createMemoryStorage();
  }
}
