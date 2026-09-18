import type { Bp, Cents, LegalForm, MonthIndex } from './input';

/** De grootheden waarop je prognose en realisatie naast elkaar kunt leggen. */
export type MetricKey = 'omzet' | 'brutomarge' | 'vasteKosten' | 'eindsaldo' | 'dscr12';

/** Wat je per maand invult; dezelfde posten als in de prognose. */
export type ActualCategory =
  | 'omzet'
  | 'inkoopwaarde'
  | 'huur'
  | 'vervoer'
  | 'verzekeringen'
  | 'telefoon_software'
  | 'accountant'
  | 'marketing'
  | 'overig'
  | 'personeel'
  | 'priveOpnamen'
  | 'rente'
  | 'aflossing'
  | 'eindsaldo';

export type MonthStatus = 'open' | 'afgesloten';

export interface ActualMonth {
  /** Prognosemaand 1..H. */
  month: MonthIndex;
  status: MonthStatus;
  source: 'handmatig' | 'csv';
  values: Partial<Record<ActualCategory, Cents>>;
}

/** Waarden per maand, index 0..H; null waar er geen waarde is. */
export type MetricSeries = Record<MetricKey, (number | null)[]>;

/**
 * Een vastgezette prognose. De reeksen worden bewaard zoals ze toen berekend waren, zodat
 * een oude versie niet verandert als de rekenkern verandert.
 */
export interface ForecastSnapshot {
  id: string;
  versionNo: number;
  kind: 'baseline' | 'reforecast';
  /** 'YYYY-MM-DD'; de rekenkern kent geen klok. */
  createdOn: string;
  note: string | null;
  engineVersion: string;
  startMonth: string;
  series: MetricSeries;
}

export type ComparisonBasis = 'baseline' | 'horizon1' | 'horizon3';

export interface AccuracyKpis {
  window: 3 | 6 | 12;
  closedMonths: number;
  /** 1 − WAPE, nooit onder 0. */
  accuracy: number;
  wape: number;
  /** Positief: de prognose lag te hoog. */
  bias: number;
  mad: number;
  trackingSignal: number | null;
  /** Boven |4| loopt de prognose structureel één kant op. */
  trackingWarning: boolean;
  hitRate: number;
}

export type DeviationStatus = 'binnen' | 'gunstig' | 'ongunstig';

export interface AccuracyMonth {
  month: MonthIndex;
  forecast: number | null;
  actual: number | null;
  reforecast: number | null;
  band: [number, number] | null;
  deviation: number | null;
  /** Afwijking gedeeld door de prognose; null als de prognose nul is. */
  deviationPct: number | null;
  status: DeviationStatus | null;
  note: string | null;
  closed: boolean;
}

export interface AccuracyInsight {
  ruleId: string;
  severity: 'info' | 'warning';
  params: Record<string, string | number>;
}

export interface AccuracyResult {
  metric: MetricKey;
  comparison: ComparisonBasis;
  toleranceBp: Bp;
  legalForm: LegalForm;
  lastClosedMonth: MonthIndex | null;
  months: AccuracyMonth[];
  kpis: AccuracyKpis | { insufficientData: true; closedMonths: number };
  /** Eerste maand in de nieuwste prognose waarin het saldo onder je buffer zakt. */
  cashWarning: { month: MonthIndex; balance: Cents; buffer: Cents } | null;
  insights: AccuracyInsight[];
}

export interface EvolutionPoint {
  versionNo: number;
  createdOn: string;
  kind: ForecastSnapshot['kind'];
  value: number | null;
  note: string | null;
}
