import { useOutletContext } from 'react-router';
import type { PlanInput } from '../../engine';

export interface WizardContext {
  planId: string;
  input: PlanInput;
  update: (recipe: (draft: PlanInput) => void) => void;
}

export function useWizard(): WizardContext {
  return useOutletContext<WizardContext>();
}
