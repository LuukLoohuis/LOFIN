/** Korte, unieke id voor regels en plannen. */
export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
