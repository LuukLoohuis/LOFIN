import { useMemo } from 'react';
import { defaultEngineConfig } from '../../config';
import { calculatePlan, type PlanInput, type PlanResult } from '../../engine';

/** Rekent het hele plan door terwijl je typt. Bij onbruikbare invoer even geen uitkomst. */
export function usePlanResult(input: PlanInput): PlanResult | null {
  return useMemo(() => {
    try {
      return calculatePlan(input, defaultEngineConfig);
    } catch {
      return null;
    }
  }, [input]);
}
