/** Reeksen lopen van maand 0 (startmoment) tot en met de laatste prognosemaand. */

export function zeros(length: number): number[] {
  return Array.from({ length }, () => 0);
}

/** Waarde op een positie; buiten de reeks is dat 0. */
export function at(values: readonly number[], index: number): number {
  return values[index] ?? 0;
}

/** Tel reeksen per positie op; de lengte volgt de eerste reeks. */
export function addSeries(first: readonly number[], ...rest: readonly (readonly number[])[]): number[] {
  return first.map((value, index) => rest.reduce((total, series) => total + at(series, index), value));
}

export function subtractSeries(minuend: readonly number[], subtrahend: readonly number[]): number[] {
  return minuend.map((value, index) => value - at(subtrahend, index));
}

export function cumulative(values: readonly number[]): number[] {
  let running = 0;
  return values.map((value) => (running += value));
}

/** Som van `first` tot en met `last`. */
export function sumRange(values: readonly number[], first: number, last: number): number {
  let total = 0;
  for (let index = first; index <= last; index++) total += at(values, index);
  return total;
}
