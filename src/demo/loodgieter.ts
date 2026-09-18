import { defaultEngineConfig } from '../config';
import {
  calculatePlan,
  ENGINE_VERSION,
  metricSeriesFromResult,
  roundCents,
  type ActualMonth,
  type Cents,
  type ForecastSnapshot,
  type PlanInput,
} from '../engine';
import type { StoredPlan } from '../data/planRepository';

/**
 * Een voorbeeldcasus om de grafieken te bekijken zonder zelf veertien maanden in te tikken:
 * loodgieter met een zomerdip die dieper uitpakte dan begroot, en een prognose die in
 * augustus is bijgesteld.
 */
const DEMO_PLAN_ID = 'plan_demo_loodgieter';

/** Afwijking van de begrote omzet per maand; juli en augustus vielen flink tegen. */
const REVENUE_DEVIATION = [
  -0.04, 0.02, -0.06, 0.03, -0.02, -0.05, -0.18, -0.22, 0.06, 0.04, 0.08, 0.02, -0.03, 0.05,
];

const CLOSED_MONTHS = REVENUE_DEVIATION.length;

export function createDemoPlanInput(): PlanInput {
  return {
    company: {
      legalForm: 'eenmanszaak',
      name: 'Loodgieter Jansen',
      kvkNumber: '87654321',
      sectorId: 'installateur',
      foundedOn: '2027-01-01',
      isStarter: true,
      ownerCount: 1,
      description: 'Loodgietersbedrijf voor particulieren en twee vaste aannemers in de regio.',
    },
    need: {
      investments: [
        {
          id: 'demo_bus',
          description: 'Bedrijfsbus met inrichting',
          category: 'bedrijfsmiddel',
          amountCents: 3_500_000,
          vatRateBp: 2100,
          lifeYears: 5,
          residualValueCents: 0,
          purchaseMonth: 0,
        },
        {
          id: 'demo_gereedschap',
          description: 'Gereedschap en meetapparatuur',
          category: 'bedrijfsmiddel',
          amountCents: 1_000_000,
          vatRateBp: 2100,
          lifeYears: 5,
          residualValueCents: 0,
          purchaseMonth: 0,
        },
      ],
      workingCapitalCents: 1_000_000,
      oneOffCosts: [
        { id: 'demo_kvk', description: 'Inschrijving en advies', amountCents: 75_000, vatRateBp: 2100, month: 0 },
      ],
      ownContributionCents: 500_000,
      grants: [],
    },
    history: { years: [], openingBalance: null },
    assumptions: {
      startMonth: '2027-01',
      revenue: { kind: 'maandbedrag', monthlyAmountCents: 1_250_000, monthlyGrowthBp: 0 },
      seasonality: [95, 95, 100, 100, 100, 100, 85, 80, 105, 110, 115, 115],
      costOfSalesBp: 3500,
      costOfSalesVatRateBp: 2100,
      fixedCosts: [
        { id: 'demo_vervoer', category: 'vervoer', description: 'Brandstof en onderhoud', amountCents: 600_000, per: 'jaar', vatRateBp: 2100 },
        { id: 'demo_verzekering', category: 'verzekeringen', description: 'Verzekeringen', amountCents: 300_000, per: 'jaar', vatRateBp: 0 },
        { id: 'demo_telefoon', category: 'telefoon_software', description: 'Telefoon en software', amountCents: 120_000, per: 'jaar', vatRateBp: 2100 },
        { id: 'demo_boekhouder', category: 'accountant', description: 'Boekhouder', amountCents: 180_000, per: 'jaar', vatRateBp: 2100 },
        { id: 'demo_marketing', category: 'marketing', description: 'Website en advertenties', amountCents: 200_000, per: 'jaar', vatRateBp: 2100 },
        { id: 'demo_overig', category: 'overig', description: 'Overige kosten', amountCents: 600_000, per: 'jaar', vatRateBp: 2100 },
      ],
      staff: [],
      privateWithdrawalsMonthlyCents: 380_000,
      dividendCents: { y1: 0, y2: 0, y3: 0 },
      debtorDays: 30,
      creditorDays: 30,
      vat: { revenueRates: [{ rateBp: 2100, shareBp: 10_000 }], filing: 'kwartaal' },
      revenueGrowthBp: { y2: 500, y3: 500 },
      costGrowthBp: { y2: 200, y3: 200 },
      minimumCashBufferCents: 250_000,
    },
    financing: {
      lines: [
        {
          id: 'demo_lening',
          kind: 'lening',
          description: 'Zakelijke lening',
          principalCents: 5_000_000,
          annualRateBp: 700,
          termMonths: 60,
          repayment: 'annuitair',
          graceMonths: 0,
          startMonth: 0,
          isRequested: true,
        },
      ],
      existingDebts: [],
      financierTypes: ['bank'],
    },
    explanations: {
      ondernemer:
        'Ik werk twaalf jaar als installateur, de laatste vier als voorman bij een installatiebedrijf. Ik heb mijn VCA en mijn F-gassencertificaat, en ken de vaste onderaannemers in de regio.',
      markt:
        'Particulieren binnen een straal van 25 kilometer, plus twee aannemers die nu al werk doorschuiven. Twee derde van mijn omzet komt van herhaalopdrachten en mond-tot-mondreclame.',
      investering:
        'Een bus met inrichting en gereedschap. Zonder eigen bus kan ik geen materiaal meenemen en moet ik werk weigeren.',
      opbrengst:
        'Met eigen vervoer kan ik twee klussen per dag doen in plaats van één. Dat is ongeveer 2.500 euro extra omzet per maand, en ik bespaar de huur van een bus.',
      risicos:
        'Als de woningmarkt stilvalt, loopt de verbouwomzet terug. Onderhoud en storingen lopen dan door; daar richt ik me in een rustige periode op. Ik houd één maand vaste lasten op de rekening.',
      zekerheden: 'De bus zelf kan als onderpand dienen. Verder heb ik geen zakelijke bezittingen.',
    },
    scenarios: { pessimisticRevenueBp: -2000, optimisticRevenueBp: 1000 },
    documents: {
      kvk_uittreksel: 'heb_ik',
      identiteitsbewijs: 'heb_ik',
      ondernemingsplan: 'heb_ik',
      cv: 'heb_ik',
      offertes: 'heb_ik',
      prive_begroting: 'nog_regelen',
      huurcontract: 'nog_regelen',
      verzekeringen: 'heb_ik',
    },
  };
}

export interface DemoCase {
  plan: StoredPlan;
  versions: ForecastSnapshot[];
  actuals: ActualMonth[];
}

/** Bouwt de hele casus: plan, twee versies en veertien afgesloten maanden. */
export function createDemoCase(): DemoCase {
  const input = createDemoPlanInput();
  const baselineResult = calculatePlan(input, defaultEngineConfig);

  // In augustus bijgesteld: de zomer viel tegen en de rest van het jaar wordt voorzichtiger.
  const adjusted = structuredClone(input);
  adjusted.assumptions.revenue = { kind: 'maandbedrag', monthlyAmountCents: 1_150_000, monthlyGrowthBp: 0 };
  const reforecastResult = calculatePlan(adjusted, defaultEngineConfig);

  const versions: ForecastSnapshot[] = [
    {
      id: 'demo_versie_1',
      versionNo: 1,
      kind: 'baseline',
      createdOn: '2026-12-15',
      note: 'Ingediend bij de bank',
      engineVersion: ENGINE_VERSION,
      startMonth: input.assumptions.startMonth,
      series: metricSeriesFromResult(baselineResult),
    },
    {
      id: 'demo_versie_2',
      versionNo: 2,
      kind: 'reforecast',
      createdOn: '2027-08-31',
      note: 'Bijgesteld na een rustige zomer: minder verbouwingen, meer onderhoud.',
      engineVersion: ENGINE_VERSION,
      startMonth: input.assumptions.startMonth,
      series: metricSeriesFromResult(reforecastResult),
    },
  ];

  const actuals = buildDemoActuals(baselineResult, input);

  return {
    plan: {
      id: DEMO_PLAN_ID,
      name: 'Voorbeeld: Loodgieter Jansen',
      createdAt: '2026-12-15T09:00:00.000Z',
      updatedAt: '2028-03-05T09:00:00.000Z',
      input,
    },
    versions,
    actuals,
  };
}

function buildDemoActuals(result: ReturnType<typeof calculatePlan>, input: PlanInput): ActualMonth[] {
  const loan = result.loans[0];
  let cash = result.cashflow.monthly[0]?.closingCash ?? 0;

  return REVENUE_DEVIATION.map((deviation, index): ActualMonth => {
    const month = index + 1;
    const planned = result.pnl.monthly[month];
    const revenue = roundCents((planned?.revenue ?? 0) * (1 + deviation));
    const costOfSales = roundCents((revenue * input.assumptions.costOfSalesBp) / 10_000);
    const fixed = fixedCostsFor(result, month);
    const withdrawals = input.assumptions.privateWithdrawalsMonthlyCents;
    const interest = loan?.rows[month]?.interest ?? 0;
    const repayment = loan?.rows[month]?.principal ?? 0;

    // Het banksaldo volgt de begroting, plus wat de omzet meer of minder opleverde.
    const plannedCash = result.cashflow.monthly[month]?.closingCash ?? 0;
    const marginEffect = roundCents((revenue - (planned?.revenue ?? 0)) * 0.65);
    cash = plannedCash + marginEffect + (index > 0 ? cash - (result.cashflow.monthly[month - 1]?.closingCash ?? 0) : 0);

    return {
      month,
      status: 'afgesloten',
      source: 'handmatig',
      values: {
        omzet: revenue,
        inkoopwaarde: costOfSales,
        ...fixed,
        personeel: 0,
        priveOpnamen: withdrawals,
        rente: interest,
        aflossing: repayment,
        eindsaldo: cash,
      },
    };
  });
}

/** De vaste kosten zoals ze werkelijk betaald zijn: gelijk aan de begroting. */
function fixedCostsFor(result: ReturnType<typeof calculatePlan>, month: number): Record<string, Cents> {
  const row = result.pnl.monthly[month];
  if (row === undefined) return {};
  return {
    huur: row.fixedCosts.huur,
    vervoer: row.fixedCosts.vervoer,
    verzekeringen: row.fixedCosts.verzekeringen,
    telefoon_software: row.fixedCosts.telefoon_software,
    accountant: row.fixedCosts.accountant,
    marketing: row.fixedCosts.marketing,
    overig: row.fixedCosts.overig,
  };
}

export { CLOSED_MONTHS, DEMO_PLAN_ID };
