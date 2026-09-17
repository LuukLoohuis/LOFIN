import { describe, expect, it } from 'vitest';
import { createDefaultPlanInput, findBranchPreset, nextMonth } from '../defaultPlan';
import { createLocalPlanRepository, createMemoryStorage, type StoredPlan } from '../planRepository';

function plan(id: string, name: string, updatedAt: string): StoredPlan {
  return { id, name, createdAt: updatedAt, updatedAt, input: createDefaultPlanInput('2027-01') };
}

describe('createLocalPlanRepository', () => {
  it('bewaart, leest en verwijdert een plan', async () => {
    const repository = createLocalPlanRepository(createMemoryStorage());
    await repository.save(plan('a', 'Eerste plan', '2026-09-01T10:00:00.000Z'));

    const loaded = await repository.load('a');
    expect(loaded?.name).toBe('Eerste plan');
    expect(await repository.list()).toHaveLength(1);

    await repository.remove('a');
    expect(await repository.load('a')).toBeNull();
    expect(await repository.list()).toEqual([]);
  });

  it('zet het laatst bewerkte plan bovenaan en overschrijft bij opnieuw opslaan', async () => {
    const repository = createLocalPlanRepository(createMemoryStorage());
    await repository.save(plan('a', 'Oud', '2026-09-01T10:00:00.000Z'));
    await repository.save(plan('b', 'Nieuw', '2026-09-02T10:00:00.000Z'));
    await repository.save(plan('a', 'Oud, bijgewerkt', '2026-09-03T10:00:00.000Z'));

    expect((await repository.list()).map((summary) => summary.name)).toEqual(['Oud, bijgewerkt', 'Nieuw']);
  });

  it('gaat niet onderuit op rommel in de opslag', async () => {
    const storage = createMemoryStorage();
    storage.setItem('lofin.plans', 'geen json');
    storage.setItem('lofin.plan.a', '{kapot');
    const repository = createLocalPlanRepository(storage);

    expect(await repository.list()).toEqual([]);
    expect(await repository.load('a')).toBeNull();
  });
});

describe('createDefaultPlanInput', () => {
  it('vult de aannames met het voorbeeld van de branche', () => {
    const input = createDefaultPlanInput('2027-01', 'installateur');
    const preset = findBranchPreset('installateur');
    expect(input.assumptions.seasonality).toEqual([...preset.seasonality]);
    expect(input.assumptions.costOfSalesBp).toBe(preset.costOfSalesBp);
    expect(input.assumptions.revenue.kind).toBe(preset.revenueModel);
    expect(input.assumptions.fixedCosts).toHaveLength(7);
    expect(input.assumptions.fixedCosts.every((line) => line.amountCents === 0)).toBe(true);
  });

  it('valt terug op het algemene voorbeeld bij een onbekende branche', () => {
    expect(findBranchPreset('bestaat-niet').id).toBe('overig');
  });
});

describe('nextMonth', () => {
  it('kiest de maand na vandaag', () => {
    expect(nextMonth(new Date('2026-09-17T12:00:00Z'))).toBe('2026-10');
    expect(nextMonth(new Date('2026-12-31T12:00:00Z'))).toBe('2027-01');
    expect(nextMonth(new Date('2027-01-01T12:00:00Z'))).toBe('2027-02');
  });
});
