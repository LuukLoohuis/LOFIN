import { describe, expect, it } from 'vitest';
import { createDefaultPlanInput } from '../defaultPlan';
import { createLocalPlanRepository, createMemoryStorage, type StoredPlan } from '../planRepository';
import { migrateLocalPlans } from '../supabaseRepository';

function plan(id: string, name: string): StoredPlan {
  const createdAt = '2026-09-01T10:00:00.000Z';
  return { id, name, createdAt, updatedAt: createdAt, input: createDefaultPlanInput('2027-01') };
}

describe('migrateLocalPlans', () => {
  it('verhuist plannen uit de browser naar het account', async () => {
    const local = createLocalPlanRepository(createMemoryStorage());
    const remote = createLocalPlanRepository(createMemoryStorage());
    await local.save(plan('a', 'Eerste'));
    await local.save(plan('b', 'Tweede'));

    const moved = await migrateLocalPlans(local, remote);

    expect(moved).toBe(2);
    expect(await local.list()).toEqual([]);
    expect((await remote.list()).map((summary) => summary.name).sort()).toEqual(['Eerste', 'Tweede']);
    expect((await remote.load('a'))?.input.assumptions.startMonth).toBe('2027-01');
  });

  it('doet niets als er niets te verhuizen valt', async () => {
    const local = createLocalPlanRepository(createMemoryStorage());
    const remote = createLocalPlanRepository(createMemoryStorage());
    expect(await migrateLocalPlans(local, remote)).toBe(0);
  });
});
