import type { ZodError } from 'zod';

export type FieldErrors = Partial<Record<string, string>>;

/**
 * Zet zod-fouten om in een opzoektabel op pad: 'investments.0.amountCents'.
 * Velden die nog leeg zijn, kleuren niet rood: dat je nog niet alles hebt ingevuld zie je aan
 * de vinkjes en de volledigheidsscore. Een fout hoort te gaan over wat je écht verkeerd invult.
 */
export function toFieldErrors(error: ZodError | null, section: unknown): FieldErrors {
  const result: FieldErrors = {};
  if (error === null) return result;
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (isEmptyValue(valueAtPath(section, issue.path))) continue;
    result[key] ??= issue.message;
  }
  return result;
}

function valueAtPath(root: unknown, path: readonly PropertyKey[]): unknown {
  let current = root;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === 0) return true;
  return Array.isArray(value) && value.length === 0;
}
