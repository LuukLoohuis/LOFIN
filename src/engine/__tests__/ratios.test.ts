import { describe, expect, it } from 'vitest';
import { defaultEngineConfig } from '../../config/engine';
import { classifyHigherIsBetter, classifyLowerIsBetter, firstMonthWhere, lowestCash } from '../plan/ratios';

const { dscr, debtToCashflow } = defaultEngineConfig.ratios;

describe('classifyHigherIsBetter', () => {
  it('kleurt de DSCR volgens de indicatieve grenzen', () => {
    expect(classifyHigherIsBetter(0.9, dscr)).toBe('rood');
    expect(classifyHigherIsBetter(1.0, dscr)).toBe('oranje');
    expect(classifyHigherIsBetter(1.29, dscr)).toBe('oranje');
    expect(classifyHigherIsBetter(1.3, dscr)).toBe('groen');
    expect(classifyHigherIsBetter(null, dscr)).toBe('geen');
  });
});

describe('classifyLowerIsBetter', () => {
  it('kleurt de schuld als veelvoud van de kasstroom', () => {
    expect(classifyLowerIsBetter(2.5, debtToCashflow)).toBe('groen');
    expect(classifyLowerIsBetter(3, debtToCashflow)).toBe('groen');
    expect(classifyLowerIsBetter(4.2, debtToCashflow)).toBe('oranje');
    expect(classifyLowerIsBetter(5, debtToCashflow)).toBe('oranje');
    expect(classifyLowerIsBetter(6.7, debtToCashflow)).toBe('rood');
  });
});

describe('lowestCash', () => {
  it('pakt het laagste saldo en de eerste maand waarin dat staat', () => {
    expect(lowestCash([100, -50, -80, -80, 20])).toEqual({ amount: -80, month: 2 });
    expect(lowestCash([100, 200])).toEqual({ amount: 100, month: 0 });
  });
});

describe('firstMonthWhere', () => {
  it('geeft de eerste maand die voldoet, of niets', () => {
    expect(firstMonthWhere([0, 0, 5, 9], (value) => value > 0)).toBe(2);
    expect(firstMonthWhere([0, 0], (value) => value > 0)).toBeNull();
  });
});
