import type { ChecklistItemConfig, EngineConfig } from '../types/config';
import type { ExplanationKey, PlanInput } from '../types/input';
import type { ChecklistItem, Completeness, Issue } from '../types/result';

const KVK_NUMBER = /^\d{8}$/;

export const EXPLANATION_KEYS: readonly ExplanationKey[] = [
  'ondernemer',
  'markt',
  'investering',
  'opbrengst',
  'risicos',
  'zekerheden',
];

/** De documenten die bij de gekozen financierstypen, rechtsvorm en fase horen. */
export function buildChecklist(input: PlanInput, items: readonly ChecklistItemConfig[]): ChecklistItem[] {
  const stage = input.company.isStarter ? 'starter' : 'bestaand';
  return items
    .filter(
      (item) =>
        (item.financierTypes === 'alle' ||
          item.financierTypes.some((type) => input.financing.financierTypes.includes(type))) &&
        (item.legalForms === 'alle' || item.legalForms.includes(input.company.legalForm)) &&
        (item.stage === 'alle' || item.stage === stage),
    )
    .map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      required: item.required,
      status: input.documents[item.id] ?? 'nog_regelen',
    }));
}

/**
 * Aandeel ingevulde verplichte velden en verzamelde documenten. Zegt iets over de
 * volledigheid van het dossier, niet over de kans op financiering.
 */
export function buildCompleteness(
  input: PlanInput,
  checklist: readonly ChecklistItem[],
  issues: readonly Issue[],
  config: EngineConfig,
): Completeness {
  const { company, need, financing, explanations, history } = input;
  const minChars = config.completeness.explanationMinChars;

  const fields = [
    { id: 'company.name', applies: true, present: company.name.trim() !== '' },
    { id: 'company.kvkNumber', applies: !company.isStarter, present: KVK_NUMBER.test(company.kvkNumber) },
    { id: 'company.description', applies: true, present: company.description.trim() !== '' },
    { id: 'history.years', applies: !company.isStarter, present: history.years.length > 0 },
    {
      id: 'need.purpose',
      applies: true,
      present: need.investments.length > 0 || need.workingCapitalCents > 0,
    },
    { id: 'financing.lines', applies: true, present: financing.lines.length > 0 },
    { id: 'financing.financierTypes', applies: true, present: financing.financierTypes.length > 0 },
    ...EXPLANATION_KEYS.map((key) => ({
      id: `explanations.${key}`,
      applies: true,
      present: explanations[key].trim().length >= minChars,
    })),
    { id: 'plan.noErrors', applies: true, present: issues.every((issue) => issue.severity !== 'error') },
  ];

  const applicable = fields.filter((field) => field.applies);
  const requiredDocuments = checklist.filter((item) => item.required);
  const present =
    applicable.filter((field) => field.present).length +
    requiredDocuments.filter((item) => item.status === 'heb_ik').length;

  return {
    score: present / (applicable.length + requiredDocuments.length),
    missingFields: applicable.filter((field) => !field.present).map((field) => field.id),
    missingDocuments: requiredDocuments.filter((item) => item.status !== 'heb_ik').map((item) => item.id),
  };
}
