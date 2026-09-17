import { describe, expect, it } from 'vitest';
import { defaultEngineConfig } from '../../config/engine';
import { corporateTax } from '../plan/tax';

const brackets = defaultEngineConfig.corporateTaxBrackets;

describe('corporateTax', () => {
  it('heft niets over verlies of nul', () => {
    expect(corporateTax(-1_000_000, brackets)).toBe(0);
    expect(corporateTax(0, brackets)).toBe(0);
  });

  it('gebruikt het lage tarief binnen de eerste schijf', () => {
    expect(corporateTax(10_000_000, brackets)).toBe(1_900_000);
  });

  it('rekent boven de schijfgrens met het hoge tarief', () => {
    expect(corporateTax(25_000_000, brackets)).toBe(5_090_000);
  });

  it('gebruikt de grens zelf nog volledig tegen het lage tarief', () => {
    expect(corporateTax(20_000_000, brackets)).toBe(3_800_000);
  });
});
