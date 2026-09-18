import type { ActualMonth, ForecastSnapshot, PlanInput } from '../engine';

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

/** Een opgeslagen kolomindeling van een boekhoudexport. */
export interface ImportMapping {
  id: string;
  name: string;
  mapping: unknown;
}

/**
 * Waar een plan wordt bewaard. Zolang iemand nog geen account heeft, is dat de browser;
 * met een account komt dezelfde interface uit op Supabase.
 */
export interface PlanRepository {
  list(): Promise<PlanSummary[]>;
  load(id: string): Promise<StoredPlan | null>;
  save(plan: StoredPlan): Promise<void>;
  remove(id: string): Promise<void>;

  listVersions(planId: string): Promise<ForecastSnapshot[]>;
  /** Een vastgezette prognose wordt nooit overschreven; er komt een versie bij. */
  addVersion(planId: string, snapshot: ForecastSnapshot): Promise<void>;

  listActuals(planId: string): Promise<ActualMonth[]>;
  saveActualMonth(planId: string, month: ActualMonth): Promise<void>;

  listMappings(): Promise<ImportMapping[]>;
  saveMapping(mapping: ImportMapping): Promise<void>;
}

const PREFIX = 'lofin.plan.';
const VERSIONS_PREFIX = 'lofin.versions.';
const ACTUALS_PREFIX = 'lofin.actuals.';
const INDEX_KEY = 'lofin.plans';
const MAPPINGS_KEY = 'lofin.mappings';

/** Opslag in de browser. Werkt ook als de browser opslag weigert: dan is er niets bewaard. */
export function createLocalPlanRepository(storage: Storage): PlanRepository {
  const read = <T>(key: string, fallback: T): T => {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const write = (key: string, value: unknown) => {
    storage.setItem(key, JSON.stringify(value));
  };

  const readIndex = () => read<PlanSummary[]>(INDEX_KEY, []);

  return {
    list: () => Promise.resolve([...readIndex()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),

    load: (id) => Promise.resolve(read<StoredPlan | null>(PREFIX + id, null)),

    save: (plan) => {
      write(PREFIX + plan.id, plan);
      const others = readIndex().filter((summary) => summary.id !== plan.id);
      write(INDEX_KEY, [...others, { id: plan.id, name: plan.name, updatedAt: plan.updatedAt }]);
      return Promise.resolve();
    },

    remove: (id) => {
      storage.removeItem(PREFIX + id);
      storage.removeItem(VERSIONS_PREFIX + id);
      storage.removeItem(ACTUALS_PREFIX + id);
      write(
        INDEX_KEY,
        readIndex().filter((summary) => summary.id !== id),
      );
      return Promise.resolve();
    },

    listVersions: (planId) => Promise.resolve(read<ForecastSnapshot[]>(VERSIONS_PREFIX + planId, [])),

    addVersion: (planId, snapshot) => {
      const versions = read<ForecastSnapshot[]>(VERSIONS_PREFIX + planId, []);
      write(VERSIONS_PREFIX + planId, [...versions, snapshot]);
      return Promise.resolve();
    },

    listActuals: (planId) => Promise.resolve(read<ActualMonth[]>(ACTUALS_PREFIX + planId, [])),

    saveActualMonth: (planId, month) => {
      const actuals = read<ActualMonth[]>(ACTUALS_PREFIX + planId, []);
      const others = actuals.filter((candidate) => candidate.month !== month.month);
      write(ACTUALS_PREFIX + planId, [...others, month].sort((a, b) => a.month - b.month));
      return Promise.resolve();
    },

    listMappings: () => Promise.resolve(read<ImportMapping[]>(MAPPINGS_KEY, [])),

    saveMapping: (mapping) => {
      const mappings = read<ImportMapping[]>(MAPPINGS_KEY, []);
      const others = mappings.filter((candidate) => candidate.id !== mapping.id);
      write(MAPPINGS_KEY, [...others, mapping]);
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
