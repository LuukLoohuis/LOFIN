import { useMemo } from 'react';
import { baseMonthlyRevenue, type PlanInput } from '../../engine';
import { validateStep, WIZARD_STEPS, type WizardStep } from '../../schema/plan';
import { toFieldErrors, type FieldErrors } from './errors';

export function useStepErrors(step: WizardStep, input: PlanInput): FieldErrors {
  return useMemo(() => toFieldErrors(validateStep(step, input), input[step.section]), [step, input]);
}

/** Een stap is af als hij klopt én er daadwerkelijk iets staat. */
export function isStepComplete(step: WizardStep, input: PlanInput): boolean {
  if (validateStep(step, input) !== null) return false;

  switch (step.section) {
    case 'company':
      return input.company.name.trim() !== '' && input.company.description.trim() !== '';
    case 'need':
      return input.need.investments.length > 0 || input.need.workingCapitalCents > 0;
    case 'history':
      return input.company.isStarter || input.history.years.length > 0;
    case 'assumptions':
      return baseMonthlyRevenue(input.assumptions.revenue) > 0;
    case 'financing':
      return input.financing.lines.length > 0 && input.financing.financierTypes.length > 0;
    case 'explanations':
      return Object.values(input.explanations).every((text) => text.trim() !== '');
  }
}

export function useStepCompletion(input: PlanInput | null): Partial<Record<number, boolean>> {
  return useMemo(() => {
    const completion: Partial<Record<number, boolean>> = {};
    if (input === null) return completion;
    for (const step of WIZARD_STEPS) completion[step.step] = isStepComplete(step, input);
    return completion;
  }, [input]);
}
