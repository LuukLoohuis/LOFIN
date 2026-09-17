/** Kolomletter bij een kolomnummer (1 = A). */
export function columnLetter(index: number): string {
  let rest = index;
  let letters = '';
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    rest = Math.floor((rest - remainder) / 26);
  }
  return letters;
}

export function cell(column: number, row: number): string {
  return `${columnLetter(column)}${row}`;
}

/** Vaste verwijzing binnen hetzelfde blad, bijvoorbeeld $C$12. */
export function absolute(column: number, row: number): string {
  return `$${columnLetter(column)}$${row}`;
}

export function range(fromColumn: number, fromRow: number, toColumn: number, toRow: number, sheet?: string): string {
  const prefix = sheet === undefined ? '' : `'${sheet}'!`;
  return `${prefix}${absolute(fromColumn, fromRow)}:${absolute(toColumn, toRow)}`;
}

/** Bedragen staan in euro's in het werkboek; de rekenkern rekent in centen. */
export function euros(cents: number): number {
  return cents / 100;
}

/** Percentages als factor: 700 basispunten wordt 0,07. */
export function factor(bp: number): number {
  return bp / 10_000;
}
