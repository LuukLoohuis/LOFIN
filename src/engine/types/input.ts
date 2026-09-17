/** Hele centen. Nooit euro's met decimalen. */
export type Cents = number;
/** Basispunten: 700 = 7,00%. */
export type Bp = number;
/** 0 = startmoment (investeringen, uitbetaling, eigen inbreng); 1 = eerste prognosemaand. */
export type MonthIndex = number;

export type LegalForm = 'eenmanszaak' | 'vof' | 'bv';
export type InvestmentCategory = 'bedrijfsmiddel' | 'verbouwing' | 'voorraad' | 'immaterieel' | 'overig';
export type FixedCostCategory =
  | 'huur'
  | 'vervoer'
  | 'verzekeringen'
  | 'telefoon_software'
  | 'accountant'
  | 'marketing'
  | 'overig';
export type RepaymentType = 'annuitair' | 'lineair' | 'aflossingsvrij';
export type LoanKind = 'lening' | 'lease' | 'achtergestelde_lening';
export type FinancierType =
  | 'bank'
  | 'microfinancier'
  | 'crowdfunding'
  | 'leasemaatschappij'
  | 'kredietunie'
  | 'familie_vrienden';
export type VatFiling = 'maand' | 'kwartaal';
export type DocumentStatus = 'heb_ik' | 'nog_regelen';
export type ExplanationKey = 'ondernemer' | 'markt' | 'investering' | 'opbrengst' | 'risicos' | 'zekerheden';

/** Groei per boekjaar ten opzichte van het vorige boekjaar. */
export interface YearGrowth {
  y2: Bp;
  y3: Bp;
}

// Stap 1 — Onderneming

export interface CompanyInput {
  legalForm: LegalForm;
  name: string;
  kvkNumber: string;
  sectorId: string;
  /** 'YYYY-MM-DD'; null als de onderneming nog niet bestaat. */
  foundedOn: string | null;
  isStarter: boolean;
  ownerCount: number;
  description: string;
}

// Stap 2 — Financieringsbehoefte

export interface InvestmentItem {
  id: string;
  description: string;
  category: InvestmentCategory;
  /** Exclusief btw. */
  amountCents: Cents;
  vatRateBp: Bp;
  /** null: niet afschrijven (bijvoorbeeld grond). Voorraad wordt nooit afgeschreven. */
  lifeYears: number | null;
  residualValueCents: Cents;
  purchaseMonth: MonthIndex;
}

export interface OneOffCost {
  id: string;
  description: string;
  /** Exclusief btw. */
  amountCents: Cents;
  vatRateBp: Bp;
  month: MonthIndex;
}

/** Subsidie of schenking: hoeft niet terug. Familieleningen en lease zijn financieringsregels. */
export interface Grant {
  id: string;
  description: string;
  amountCents: Cents;
  month: MonthIndex;
}

export interface FinancingNeedInput {
  investments: InvestmentItem[];
  workingCapitalCents: Cents;
  oneOffCosts: OneOffCost[];
  ownContributionCents: Cents;
  grants: Grant[];
}

// Stap 3 — Historische cijfers

export interface HistoricalYear {
  year: number;
  revenueCents: Cents;
  costOfSalesCents: Cents;
  operatingCostsCents: Record<FixedCostCategory, Cents>;
  staffCents: Cents;
  depreciationCents: Cents;
  interestCents: Cents;
  netProfitCents: Cents;
  privateWithdrawalsCents: Cents;
  balance: {
    fixedAssetsCents: Cents;
    stockCents: Cents;
    receivablesCents: Cents;
    cashCents: Cents;
    equityCents: Cents;
    debtCents: Cents;
  };
}

/**
 * Balans op de startdatum van de prognose. Voorgevuld met de laatste jaarbalans, maar
 * aan te passen: tussen die balans en de start kunnen maanden zitten.
 * Bestaande leningen staan niet hier maar bij de bestaande schulden (stap 5).
 */
export interface OpeningBalanceInput {
  fixedAssetsCents: Cents;
  /** Afschrijving per jaar op de bestaande vaste activa. */
  annualDepreciationCents: Cents;
  stockCents: Cents;
  receivablesCents: Cents;
  cashCents: Cents;
  equityCents: Cents;
  payablesCents: Cents;
  otherLiabilitiesCents: Cents;
}

export interface HistoryInput {
  years: HistoricalYear[];
  openingBalance: OpeningBalanceInput | null;
}

// Stap 4 — Prognose-aannames

export type RevenueModel =
  | { kind: 'uurtarief'; hourlyRateCents: Cents; billableHoursPerMonth: number }
  | { kind: 'opdrachten'; jobsPerMonth: number; averageJobValueCents: Cents }
  | { kind: 'maandbedrag'; monthlyAmountCents: Cents; monthlyGrowthBp: Bp };

export interface FixedCostLine {
  id: string;
  category: FixedCostCategory;
  description: string;
  /** Exclusief btw. */
  amountCents: Cents;
  per: 'maand' | 'jaar';
  vatRateBp: Bp;
}

export interface StaffLine {
  id: string;
  description: string;
  grossMonthlyCents: Cents;
  /** Werkgeverslasten bovenop het brutoloon, inclusief vakantiegeld. */
  employerCostBp: Bp;
  startMonth: MonthIndex;
  endMonth: MonthIndex | null;
}

export interface VatRateShare {
  rateBp: Bp;
  /** Aandeel van de omzet; alle aandelen samen 10.000. */
  shareBp: Bp;
}

export interface AssumptionsInput {
  /** Eerste prognosemaand, 'YYYY-MM'. */
  startMonth: string;
  revenue: RevenueModel;
  /** Twaalf gewichten in honderdsten, januari eerst. Samen 1200. */
  seasonality: number[];
  costOfSalesBp: Bp;
  costOfSalesVatRateBp: Bp;
  fixedCosts: FixedCostLine[];
  staff: StaffLine[];
  /** Eenmanszaak en vof: inclusief reservering voor inkomstenbelasting en Zvw. */
  privateWithdrawalsMonthlyCents: Cents;
  /** Bv: dividend per boekjaar, uitgekeerd in december. */
  dividendCents: { y1: Cents; y2: Cents; y3: Cents };
  debtorDays: number;
  creditorDays: number;
  vat: { revenueRates: VatRateShare[]; filing: VatFiling };
  revenueGrowthBp: YearGrowth;
  costGrowthBp: YearGrowth;
  minimumCashBufferCents: Cents;
}

// Stap 5 — Financiering

export interface LoanLine {
  id: string;
  kind: LoanKind;
  description: string;
  principalCents: Cents;
  annualRateBp: Bp;
  /** Looptijd inclusief aflossingsvrije periode. */
  termMonths: number;
  repayment: RepaymentType;
  graceMonths: number;
  /** Maand van uitbetaling; de eerste termijn volgt een maand later. */
  startMonth: MonthIndex;
  /** false: overige bron (zoals een familielening) die niet bij de financier wordt aangevraagd. */
  isRequested: boolean;
}

export interface CreditLine {
  id: string;
  kind: 'krediet';
  description: string;
  limitCents: Cents;
  annualRateBp: Bp;
  startMonth: MonthIndex;
  isRequested: boolean;
}

export type FinancingLine = LoanLine | CreditLine;

export interface ExistingDebt {
  id: string;
  description: string;
  outstandingCents: Cents;
  annualRateBp: Bp;
  remainingMonths: number;
  repayment: RepaymentType;
}

export interface FinancingInput {
  lines: FinancingLine[];
  existingDebts: ExistingDebt[];
  financierTypes: FinancierType[];
}

// Stap 6 en verder

export type ExplanationsInput = Record<ExplanationKey, string>;

export interface ScenarioSettings {
  pessimisticRevenueBp: Bp;
  optimisticRevenueBp: Bp;
}

export interface PlanInput {
  company: CompanyInput;
  need: FinancingNeedInput;
  history: HistoryInput;
  assumptions: AssumptionsInput;
  financing: FinancingInput;
  explanations: ExplanationsInput;
  scenarios: ScenarioSettings;
  /** Status per checklist-item (id uit de config). Ontbreekt = nog regelen. */
  documents: Partial<Record<string, DocumentStatus>>;
}
