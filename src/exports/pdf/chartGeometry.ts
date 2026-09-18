/** Meetkunde voor de grafiek in de pdf: react-pdf tekent zelf geen assen of lijnen. */

export interface ChartSeriesPoint {
  label: string;
  forecast: number | null;
  actual: number | null;
  reforecast: number | null;
  band: [number, number] | null;
}

export interface ChartLayout {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface ChartGeometry {
  plot: { x: number; y: number; width: number; height: number };
  bandPath: string | null;
  forecastPath: string | null;
  reforecastPath: string | null;
  actualPath: string | null;
  ticks: { value: number; y: number }[];
  labels: { label: string; x: number }[];
  markerX: number | null;
}

/** Bepaalt schaal en padstrings; buiten bereik vallende punten breken de lijn niet op. */
export function buildChartGeometry(
  points: readonly ChartSeriesPoint[],
  layout: ChartLayout,
  lastClosedIndex: number | null,
  tickCount = 4,
): ChartGeometry {
  const plot = {
    x: layout.padding.left,
    y: layout.padding.top,
    width: layout.width - layout.padding.left - layout.padding.right,
    height: layout.height - layout.padding.top - layout.padding.bottom,
  };

  const values = points.flatMap((point) => [
    point.forecast,
    point.actual,
    point.reforecast,
    ...(point.band ?? []),
  ]);
  const usable = values.filter((value): value is number => value !== null);
  const max = usable.length === 0 ? 1 : Math.max(...usable, 0);
  const min = usable.length === 0 ? 0 : Math.min(...usable, 0);
  const span = max - min === 0 ? 1 : max - min;

  const xFor = (index: number) =>
    plot.x + (points.length <= 1 ? 0 : (index / (points.length - 1)) * plot.width);
  const yFor = (value: number) => plot.y + plot.height - ((value - min) / span) * plot.height;

  const line = (pick: (point: ChartSeriesPoint) => number | null): string | null => {
    const segments: string[] = [];
    let started = false;
    points.forEach((point, index) => {
      const value = pick(point);
      if (value === null) {
        started = false;
        return;
      }
      segments.push(`${started ? 'L' : 'M'} ${round(xFor(index))} ${round(yFor(value))}`);
      started = true;
    });
    return segments.length === 0 ? null : segments.join(' ');
  };

  const withBand = points
    .map((point, index) => ({ point, index }))
    .filter((entry): entry is { point: ChartSeriesPoint & { band: [number, number] }; index: number } =>
      entry.point.band !== null,
    );
  const bandPath =
    withBand.length === 0
      ? null
      : [
          ...withBand.map(
            (entry, position) =>
              `${position === 0 ? 'M' : 'L'} ${round(xFor(entry.index))} ${round(yFor(entry.point.band[1]))}`,
          ),
          ...[...withBand]
            .reverse()
            .map((entry) => `L ${round(xFor(entry.index))} ${round(yFor(entry.point.band[0]))}`),
          'Z',
        ].join(' ');

  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = min + (span * index) / tickCount;
    return { value, y: yFor(value) };
  });

  // Niet elke maand past als label; toon er hooguit acht.
  const step = Math.max(1, Math.ceil(points.length / 8));
  const labels = points
    .map((point, index) => ({ label: point.label, x: xFor(index), index }))
    .filter((entry) => entry.index % step === 0)
    .map(({ label, x }) => ({ label, x }));

  return {
    plot,
    bandPath,
    forecastPath: line((point) => point.forecast),
    reforecastPath: line((point) => point.reforecast),
    actualPath: line((point) => point.actual),
    ticks,
    labels,
    markerX: lastClosedIndex === null ? null : xFor(lastClosedIndex),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
