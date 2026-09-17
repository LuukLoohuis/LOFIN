import type {
  Bp,
  Cents,
  DocumentStatus,
  FixedCostCategory,
  InvestmentCategory,
  LegalForm,
  LoanKind,
  MonthIndex,
} from './input';

export type Light = 'groen' | 'oranje' | 'rood' | 'geen';
export type Severity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'SEASONALITY_INVALID'
  | 'VAT_MIX_INVALID'
  | 'FUNDING_IMBALANCE'
  | 'GRACE_TOO_LONG'
  | 'MONTH_OUTSIDE_HORIZON'
  | 'NEGATIVE_CASH'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'OPENING_BALANCE_MISMATCH'
  | 'WITHDRAWALS_IGNORED_FOR_BV'
  | 'BALLOON_IN_HORIZON';

/** De tekst staat in de config; de rekenkern levert alleen code en waarden. */
export interface Issue {
  code: IssueCode;
  severity: Severity;
  path: string;
  params: Record<string, string | number>;
}

// Tijdlijn

export type PeriodKey = 'start' | 'y1' | 'y2' | 'y3';
export type YearKey = Exclude<PeriodKey, 'start'>;

/** Een boekjaar (januari–december) of de verkorte startperiode ervoor. */
export interface FiscalPeriod {
  key: PeriodKey;
  calendarYear: number;
  firstMonth: MonthIndex;
  lastMonth: MonthIndex;
  months: number;
}

export interface MonthMeta {
  index: MonthIndex;
  year: number;
  /** 1–12. Het startmoment (index 0) valt in de eerste prognosemaand. */
  month: number;
  quarter: 1 | 2 | 3 | 4;
  period: PeriodKey;
}

// Resultatenrekening en kasstroom

export interface PnlRow {
  revenue: Cents;
  costOfSales: Cents;
  grossMargin: Cents;
  fixedCosts: Record<FixedCostCategory, Cents>;
  fixedCostsTotal: Cents;
  staff: Cents;
  oneOffCosts: Cents;
  depreciation: Cents;
  ebit: Cents;
  interest: Cents;
  resultBeforeTax: Cents;
  corporateTax: Cents;
  netResult: Cents;
  privateWithdrawals: Cents;
  dividend: Cents;
  cfads: Cents;
  repayments: Cents;
  debtService: Cents;
}

export interface CashRow {
  openingCash: Cents;
  receipts: {
    customers: Cents;
    financing: Cents;
    ownContribution: Cents;
    grants: Cents;
    vatRefund: Cents;
    total: Cents;
  };
  payments: {
    operations: { costOfSales: Cents; fixedCosts: Cents; staff: Cents; oneOffCosts: Cents; total: Cents };
    vat: Cents;
    investments: Cents;
    interest: Cents;
    repayments: Cents;
    privateWithdrawals: Cents;
    corporateTax: Cents;
    dividend: Cents;
    total: Cents;
  };
  netCashflow: Cents;
  closingCash: Cents;
  /** Beschikbare kredietlimiet aan het eind van de periode. */
  creditLimit: Cents;
  creditDrawn: Cents;
  /** Tekort bovenop de kredietlimiet. */
  shortfall: Cents;
}

// Financiering

export interface ScheduleRow {
  month: MonthIndex;
  openingBalance: Cents;
  drawdown: Cents;
  interest: Cents;
  principal: Cents;
  closingBalance: Cents;
}

export interface PeriodDebtSummary {
  period: PeriodKey;
  interest: Cents;
  principal: Cents;
  closingBalance: Cents;
}

export interface LoanSchedule {
  lineId: string;
  description: string;
  origin: 'nieuw' | 'bestaand';
  kind: LoanKind | 'bestaande_schuld';
  subordinated: boolean;
  principal: Cents;
  annualRateBp: Bp;
  termMonths: number;
  /** Termijnbedrag na de aflossingsvrije periode; alleen bij annuïteit. */
  annuityPayment: Cents | null;
  /** Vaste aflossing per maand; alleen bij lineair. */
  linearPrincipal: Cents | null;
  rows: ScheduleRow[];
  periods: PeriodDebtSummary[];
}

export interface CreditLineUsage {
  lineId: string;
  description: string;
  limit: Cents;
  annualRateBp: Bp;
  drawn: Cents[];
  interest: Cents[];
  periods: PeriodDebtSummary[];
}

export interface AssetSchedule {
  investmentId: string | null;
  depreciation: Cents[];
  bookValue: Cents[];
}

export interface FinancingNeedResult {
  uses: {
    investmentsByCategory: Record<InvestmentCategory, Cents>;
    investments: Cents;
    workingCapital: Cents;
    oneOffCosts: Cents;
    total: Cents;
  };
  sources: {
    ownContribution: Cents;
    grants: Cents;
    /** Financieringsregels die niet worden aangevraagd, zoals een familielening. */
    otherFinancing: Cents;
    requestedFinancing: Cents;
    total: Cents;
  };
  /** Bestedingen min eigen inbreng, subsidies en overige financiering. */
  financingNeed: Cents;
  /** Bronnen min bestedingen; alles behalve 0 is een fout. */
  difference: Cents;
  vatOnInvestments: {
    total: Cents;
    settlements: { purchaseMonth: MonthIndex; vat: Cents; settledInMonth: MonthIndex | null }[];
  };
}

// Btw en balans

export interface VatResult {
  output: Cents[];
  input: Cents[];
  payments: Cents[];
  refunds: Cents[];
  /** Na maand m: te betalen (positief) of te vorderen (negatief). */
  position: Cents[];
  /** Maand waarin de aangifte over maand m wordt verrekend; null na de horizon. */
  settlementMonth: (MonthIndex | null)[];
}

export interface BalanceSheet {
  fixedAssets: Cents;
  stock: Cents;
  receivables: Cents;
  vatReceivable: Cents;
  cash: Cents;
  totalAssets: Cents;
  equity: Cents;
  subordinatedLoans: Cents;
  loans: Cents;
  creditDrawn: Cents;
  payables: Cents;
  vatPayable: Cents;
  corporateTaxPayable: Cents;
  otherLiabilities: Cents;
  totalLiabilities: Cents;
}

// Ratio's, scenario's en volledigheid

export interface PeriodRatio {
  period: PeriodKey;
  value: number | null;
  light: Light;
}

export interface Ratios {
  dscr: PeriodRatio[];
  lowestCash: { amount: Cents; month: MonthIndex; creditLimit: Cents; light: Light };
  breakEven: {
    period: PeriodKey;
    revenue: Cents | null;
    /** Eenmanszaak en vof: inclusief privé-opnamen. */
    revenueInclWithdrawals: Cents | null;
    actualRevenue: Cents;
  }[];
  solvency: (PeriodRatio & { valueInclSubordinated: number | null })[];
  debtToCashflow: { value: number | null; debt: Cents; cfads: Cents; light: Light };
}

export type ScenarioKey = 'basis' | 'pessimistisch' | 'optimistisch';

export interface ScenarioSummary {
  key: ScenarioKey;
  revenueDeltaBp: Bp;
  revenue: Cents;
  dscr: PeriodRatio[];
  lowestCash: { amount: Cents; month: MonthIndex };
  firstNegativeMonth: MonthIndex | null;
  /** Eerste maand waarin ook de kredietlimiet niet genoeg is. */
  firstShortfallMonth: MonthIndex | null;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
  status: DocumentStatus;
}

export interface Completeness {
  /** 0–1: aandeel verplichte velden en documenten dat aanwezig is. Geen kans op financiering. */
  score: number;
  missingFields: string[];
  missingDocuments: string[];
}

export interface PlanResult {
  meta: {
    engineVersion: string;
    legalForm: LegalForm;
    horizonMonths: number;
    months: MonthMeta[];
    periods: FiscalPeriod[];
  };
  issues: Issue[];
  financingNeed: FinancingNeedResult;
  pnl: { monthly: PnlRow[]; periods: (PnlRow & { period: PeriodKey })[] };
  cashflow: {
    monthly: CashRow[];
    quarterly: (CashRow & { year: number; quarter: 1 | 2 | 3 | 4 })[];
    periods: (CashRow & { period: PeriodKey })[];
  };
  loans: LoanSchedule[];
  creditLines: CreditLineUsage[];
  depreciation: AssetSchedule[];
  vat: VatResult;
  balanceSheet: {
    opening: BalanceSheet;
    monthly: BalanceSheet[];
    periodEnds: (BalanceSheet & { period: PeriodKey })[];
  };
  ratios: Ratios;
  scenarios: ScenarioSummary[];
  checklist: ChecklistItem[];
  completeness: Completeness;
}
