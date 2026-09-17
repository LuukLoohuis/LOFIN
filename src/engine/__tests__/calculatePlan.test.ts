import { describe, expect, it } from 'vitest';
import { defaultEngineConfig } from '../../config/engine';
import { sum } from '../core/money';
import { at } from '../core/series';
import { calculatePlan } from '../plan/calculatePlan';
import { EngineInputError } from '../core/errors';
import type { PeriodKey, PlanResult } from '../types/result';
import { makePlan } from './fixtures/builders';
import { jansenPlan } from './fixtures/jansen';

const config = defaultEngineConfig;

function period(result: PlanResult, key: PeriodKey) {
  const row = result.pnl.periods.find((candidate) => candidate.period === key);
  if (row === undefined) throw new Error(`periode ${key} ontbreekt`);
  return row;
}

describe('Loodgieter Jansen — testcasus', () => {
  const result = calculatePlan(jansenPlan, config);
  const year1 = period(result, 'y1');

  it('deelt de horizon in drie boekjaren in', () => {
    expect(result.meta.horizonMonths).toBe(36);
    expect(result.meta.periods.map((p) => p.key)).toEqual(['y1', 'y2', 'y3']);
    expect(result.meta.engineVersion).toBe('1.0.0');
  });

  it('komt uit op de resultaten uit de specificatie', () => {
    expect(year1.revenue).toBe(15_000_000);
    expect(year1.costOfSales).toBe(5_250_000);
    expect(year1.grossMargin).toBe(9_750_000);
    expect(year1.fixedCostsTotal).toBe(2_000_000);
    expect(year1.depreciation).toBe(900_000);
    expect(year1.ebit).toBe(6_850_000);
    expect(year1.privateWithdrawals).toBe(4_560_000);
    expect(year1.cfads).toBe(3_190_000);
  });

  it('komt uit op de schuldendienst en DSCR uit de specificatie', () => {
    expect(year1.interest).toBe(322_580);
    expect(year1.repayments).toBe(865_492);
    expect(year1.debtService).toBe(1_188_072);

    const dscr = result.ratios.dscr.find((ratio) => ratio.period === 'y1');
    expect(dscr?.value).toBeCloseTo(2.685, 3);
    expect(dscr?.value?.toFixed(2)).toBe('2.69');
    expect(dscr?.light).toBe('groen');
    expect(result.loans[0]?.annuityPayment).toBe(99_006);
  });

  it('laat zien dat de btw op de investeringen eerst uit de kas gaat', () => {
    expect(result.cashflow.monthly[0]?.payments.investments).toBe(5_445_000);
    expect(result.cashflow.monthly[0]?.closingCash).toBe(55_000);
    expect(result.cashflow.monthly[4]?.receipts.vatRefund).toBe(522_375);
    expect(result.issues.map((issue) => issue.code)).toContain('NEGATIVE_CASH');
  });

  it('berekent de break-evenomzet met en zonder privé-opnamen', () => {
    const breakEven = result.ratios.breakEven.find((row) => row.period === 'y1');
    // (20.000 vaste kosten + 9.000 afschrijving + 3.225,80 rente) / 65% brutomarge.
    expect(breakEven?.revenue).toBe(4_957_815);
    expect(breakEven?.revenueInclWithdrawals).toBe(11_973_200);
  });

  it('houdt de schuld ruim binnen de kasstroom', () => {
    expect(result.ratios.debtToCashflow.debt).toBe(5_000_000);
    expect(result.ratios.debtToCashflow.value).toBeCloseTo(1.567, 3);
    expect(result.ratios.debtToCashflow.light).toBe('groen');
  });

  it('zet de scenario’s naast elkaar', () => {
    const [base, pessimistic, optimistic] = result.scenarios;
    expect(base?.revenue).toBe(45_000_000);
    expect(pessimistic?.revenue).toBe(36_000_000);
    expect(optimistic?.revenue).toBe(49_500_000);
    expect(pessimistic?.firstNegativeMonth).not.toBeNull();
    expect((pessimistic?.dscr[0]?.value ?? 0) < (base?.dscr[0]?.value ?? 0)).toBe(true);
  });

  it('houdt de balans sluitend in elke maand', () => {
    for (const sheet of result.balanceSheet.monthly) {
      expect(sheet.totalAssets - sheet.totalLiabilities).toBe(0);
    }
    expect(result.balanceSheet.periodEnds.map((sheet) => sheet.period)).toEqual(['y1', 'y2', 'y3']);
  });

  it('laat de solvabiliteit meegroeien met de winst', () => {
    const [first, , last] = result.ratios.solvency;
    expect(first?.value).toBeGreaterThan(0);
    expect(last?.value ?? 0).toBeGreaterThan(first?.value ?? 1);
    expect(first?.valueInclSubordinated).toBe(first?.value);
  });

  it('vraagt om documenten die bij een bank en een starter horen', () => {
    const ids = result.checklist.map((item) => item.id);
    expect(ids).toContain('cv');
    expect(ids).toContain('prive_begroting');
    expect(ids).not.toContain('jaarrekeningen');
    expect(ids).not.toContain('statuten');
    expect(result.checklist.every((item) => item.status === 'nog_regelen')).toBe(true);
  });

  it('meet de volledigheid zonder iets te beloven', () => {
    expect(result.completeness.score).toBeGreaterThan(0);
    expect(result.completeness.score).toBeLessThan(1);
    expect(result.completeness.missingFields).toContain('explanations.ondernemer');
    expect(result.completeness.missingDocuments).toContain('kvk_uittreksel');
  });

  it('telt de maandregels op tot de periodes', () => {
    expect(sum(result.pnl.monthly.slice(0, 13).map((row) => row.revenue))).toBe(year1.revenue);
    expect(result.cashflow.quarterly).toHaveLength(12);
    expect(result.cashflow.periods[0]?.closingCash).toBe(result.cashflow.monthly[12]?.closingCash);
  });
});

describe('volledig dossier', () => {
  it('geeft een score van 1 als alles er is', () => {
    const plan = makePlan((draft) => {
      Object.assign(draft, structuredClone(jansenPlan));
      const text = 'a'.repeat(config.completeness.explanationMinChars);
      draft.explanations = {
        ondernemer: text,
        markt: text,
        investering: text,
        opbrengst: text,
        risicos: text,
        zekerheden: text,
      };
      for (const item of config.checklist) draft.documents[item.id] = 'heb_ik';
    });
    const result = calculatePlan(plan, config);
    expect(result.completeness.score).toBe(1);
    expect(result.completeness.missingFields).toEqual([]);
  });

  it('rekent het kvk-nummer en de historie mee bij een bestaand bedrijf', () => {
    const plan = makePlan((draft) => {
      draft.company.isStarter = false;
      draft.company.kvkNumber = '123';
    });
    const result = calculatePlan(plan, config);
    expect(result.completeness.missingFields).toContain('company.kvkNumber');
    expect(result.completeness.missingFields).toContain('history.years');
    expect(result.completeness.missingFields).toContain('need.purpose');
  });
});

describe('bv', () => {
  const bvPlan = makePlan((draft) => {
    draft.company.legalForm = 'bv';
    draft.assumptions.revenue = { kind: 'maandbedrag', monthlyAmountCents: 1_000_000, monthlyGrowthBp: 0 };
    draft.assumptions.dividendCents = { y1: 500_000, y2: 0, y3: 0 };
  });
  const result = calculatePlan(bvPlan, config);

  it('rekent vennootschapsbelasting over het boekjaar', () => {
    expect(period(result, 'y1').corporateTax).toBe(2_280_000);
    expect(period(result, 'y1').cfads).toBe(12_000_000 - 2_280_000 - 500_000);
  });

  it('betaalt de aanslag in termijnen in het volgende boekjaar', () => {
    expect(result.cashflow.monthly[12]?.payments.corporateTax).toBe(0);
    expect(result.cashflow.monthly[13]?.payments.corporateTax).toBe(190_000);
    expect(result.cashflow.periods[1]?.payments.corporateTax).toBe(2_280_000);
    expect(result.balanceSheet.periodEnds[0]?.corporateTaxPayable).toBe(2_280_000);
  });

  it('keert dividend uit in december', () => {
    expect(result.cashflow.monthly[12]?.payments.dividend).toBe(500_000);
  });

  it('verrekent verlies met de winst van latere jaren', () => {
    const lossPlan = makePlan((draft) => {
      draft.company.legalForm = 'bv';
      draft.assumptions.revenue = { kind: 'maandbedrag', monthlyAmountCents: 500_000, monthlyGrowthBp: 0 };
      draft.assumptions.staff = [
        {
          id: 'team',
          description: 'Team',
          grossMonthlyCents: 1_000_000,
          employerCostBp: 0,
          startMonth: 1,
          endMonth: 12,
        },
      ];
    });
    const lossResult = calculatePlan(lossPlan, config);
    expect(period(lossResult, 'y1').resultBeforeTax).toBe(-6_000_000);
    expect(period(lossResult, 'y1').corporateTax).toBe(0);
    expect(period(lossResult, 'y2').corporateTax).toBe(0);
    expect(period(lossResult, 'y3').corporateTax).toBe(1_140_000);
  });

  it('negeert privé-opnamen en meldt dat', () => {
    const plan = makePlan((draft) => {
      draft.company.legalForm = 'bv';
      draft.assumptions.privateWithdrawalsMonthlyCents = 300_000;
    });
    const withWithdrawals = calculatePlan(plan, config);
    expect(withWithdrawals.pnl.periods[0]?.privateWithdrawals).toBe(0);
    expect(withWithdrawals.issues.map((issue) => issue.code)).toContain('WITHDRAWALS_IGNORED_FOR_BV');
    expect(withWithdrawals.ratios.breakEven[0]?.revenueInclWithdrawals).toBeNull();
  });
});

describe('rekening-courantkrediet', () => {
  const creditPlan = makePlan((draft) => {
    draft.need.ownContributionCents = 100_000;
    draft.assumptions.fixedCosts = [
      { id: 'huur', category: 'huur', description: 'Huur', amountCents: 50_000, per: 'maand', vatRateBp: 0 },
    ];
    draft.financing.lines = [
      {
        id: 'krediet',
        kind: 'krediet',
        description: 'Rekening-courant',
        limitCents: 200_000,
        annualRateBp: 1200,
        startMonth: 0,
        isRequested: true,
      },
    ];
  });

  it('rekent rente over de roodstand van de vorige maand', () => {
    const result = calculatePlan(creditPlan, config);
    const usage = result.creditLines[0];
    expect(usage?.drawn[2]).toBe(0);
    expect(usage?.drawn[3]).toBe(50_000);
    expect(usage?.interest[3]).toBe(0);
    expect(usage?.interest[4]).toBe(500);
    expect(result.pnl.monthly[4]?.interest).toBe(500);
  });

  it('meldt het als de limiet niet genoeg is', () => {
    const result = calculatePlan(creditPlan, config);
    const exceeded = result.issues.find((issue) => issue.code === 'CREDIT_LIMIT_EXCEEDED');
    expect(exceeded?.params.month).toBe(6);
    expect(result.cashflow.monthly[6]?.creditDrawn).toBe(200_000);
    expect(result.cashflow.monthly[6]?.shortfall).toBeGreaterThan(0);
    expect(result.scenarios[0]?.firstShortfallMonth).toBe(6);
  });

  it('is er nog niet als het krediet later ingaat', () => {
    const later = makePlan((draft) => {
      Object.assign(draft, structuredClone(creditPlan));
      const [line] = draft.financing.lines;
      if (line?.kind !== 'krediet') throw new Error('geen krediet');
      line.startMonth = 5;
    });
    const result = calculatePlan(later, config);
    expect(result.cashflow.monthly[3]?.creditLimit).toBe(0);
    expect(result.cashflow.monthly[3]?.shortfall).toBe(50_000);
    expect(result.cashflow.monthly[5]?.creditLimit).toBe(200_000);
    expect(result.creditLines[0]?.drawn[5]).toBeGreaterThan(0);
  });

  it('laat zonder krediet het tekort gewoon zien', () => {
    const withoutCredit = makePlan((draft) => {
      Object.assign(draft, structuredClone(creditPlan));
      draft.financing.lines = [];
    });
    const result = calculatePlan(withoutCredit, config);
    expect(result.scenarios[0]?.firstNegativeMonth).toBe(3);
    expect(result.ratios.lowestCash.light).toBe('rood');
    expect(result.issues.map((issue) => issue.code)).not.toContain('CREDIT_LIMIT_EXCEEDED');
  });
});

describe('start buiten januari', () => {
  const result = calculatePlan(
    makePlan((draft) => {
      Object.assign(draft, structuredClone(jansenPlan));
      draft.assumptions.startMonth = '2026-10';
    }),
    config,
  );

  it('zet een verkorte startperiode voor drie volle boekjaren', () => {
    expect(result.meta.horizonMonths).toBe(39);
    expect(result.pnl.periods.map((row) => row.period)).toEqual(['start', 'y1', 'y2', 'y3']);
    expect(period(result, 'start').revenue).toBe(3_750_000);
    expect(period(result, 'start').fixedCostsTotal).toBe(500_000);
    expect(period(result, 'y1').revenue).toBe(15_000_000);
  });

  it('geeft ook de startperiode een DSCR en een balans', () => {
    expect(result.ratios.dscr).toHaveLength(4);
    expect(result.ratios.solvency[0]?.period).toBe('start');
    for (const sheet of result.balanceSheet.monthly) {
      expect(sheet.totalAssets - sheet.totalLiabilities).toBe(0);
    }
  });
});

describe('bestaand bedrijf', () => {
  const existing = makePlan((draft) => {
    draft.company.isStarter = false;
    draft.assumptions.revenue = { kind: 'maandbedrag', monthlyAmountCents: 1_000_000, monthlyGrowthBp: 0 };
    draft.assumptions.debtorDays = 30;
    draft.assumptions.creditorDays = 30;
    draft.assumptions.costOfSalesBp = 4000;
    draft.history.openingBalance = {
      fixedAssetsCents: 1_200_000,
      annualDepreciationCents: 240_000,
      stockCents: 0,
      receivablesCents: 500_000,
      cashCents: 200_000,
      equityCents: 1_000_000,
      payablesCents: 300_000,
      otherLiabilitiesCents: 0,
    };
    draft.financing.existingDebts = [
      {
        id: 'oud',
        description: 'Lopende lening',
        outstandingCents: 600_000,
        annualRateBp: 400,
        remainingMonths: 24,
        repayment: 'lineair',
      },
    ];
  });

  it('neemt de openingsbalans en de lopende lening mee', () => {
    const result = calculatePlan(existing, config);
    expect(result.balanceSheet.opening.totalAssets).toBe(1_900_000);
    expect(result.balanceSheet.opening.loans).toBe(600_000);
    expect(result.issues.map((issue) => issue.code)).not.toContain('OPENING_BALANCE_MISMATCH');
    expect(result.cashflow.monthly[1]?.receipts.customers).toBe(500_000);
    expect(result.cashflow.monthly[1]?.payments.operations.costOfSales).toBe(300_000);
    expect(period(result, 'y1').depreciation).toBe(240_000);
    expect(result.ratios.debtToCashflow.debt).toBe(600_000);
  });

  it('meldt een balans die niet sluit en vult het verschil aan', () => {
    const unbalanced = makePlan((draft) => {
      Object.assign(draft, structuredClone(existing));
      if (draft.history.openingBalance) draft.history.openingBalance.equityCents = 900_000;
    });
    const result = calculatePlan(unbalanced, config);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'OPENING_BALANCE_MISMATCH', params: { difference: 100_000 } }),
    );
    expect(result.balanceSheet.opening.otherLiabilities).toBe(100_000);
    expect(result.balanceSheet.monthly.every((sheet) => sheet.totalAssets === sheet.totalLiabilities)).toBe(true);
  });
});

describe('signalen', () => {
  it('weigert een onbegrijpelijke startmaand', () => {
    const plan = makePlan((draft) => {
      draft.assumptions.startMonth = 'ergens in 2027';
    });
    expect(() => calculatePlan(plan, config)).toThrow(EngineInputError);
  });

  it('meldt seizoensgewichten die niet op 12 uitkomen', () => {
    const plan = makePlan((draft) => {
      draft.assumptions.seasonality = Array.from({ length: 12 }, (_, index) => (index === 0 ? 110 : 100));
    });
    const result = calculatePlan(plan, config);
    expect(result.issues.map((issue) => issue.code)).toContain('SEASONALITY_INVALID');
  });

  it('meldt een btw-verdeling die geen 100% is', () => {
    const plan = makePlan((draft) => {
      draft.assumptions.vat.revenueRates = [
        { rateBp: 2100, shareBp: 8000 },
        { rateBp: 900, shareBp: 1000 },
      ];
    });
    expect(calculatePlan(plan, config).issues.map((issue) => issue.code)).toContain('VAT_MIX_INVALID');
  });

  it('meldt een aflossingsvrije periode die de looptijd overschrijdt', () => {
    const plan = makePlan((draft) => {
      draft.financing.lines = [
        {
          id: 'lening',
          kind: 'lening',
          description: 'Lening',
          principalCents: 1_000_000,
          annualRateBp: 500,
          termMonths: 12,
          repayment: 'annuitair',
          graceMonths: 12,
          startMonth: 0,
          isRequested: true,
        },
      ];
    });
    const codes = calculatePlan(plan, config).issues.map((issue) => issue.code);
    expect(codes).toContain('GRACE_TOO_LONG');
    expect(codes).toContain('BALLOON_IN_HORIZON');
  });

  it('meldt een slottermijn binnen de horizon', () => {
    const plan = makePlan((draft) => {
      draft.financing.lines = [
        {
          id: 'lening',
          kind: 'lening',
          description: 'Lening',
          principalCents: 1_000_000,
          annualRateBp: 500,
          termMonths: 24,
          repayment: 'aflossingsvrij',
          graceMonths: 0,
          startMonth: 0,
          isRequested: true,
        },
      ];
      draft.need.workingCapitalCents = 1_000_000;
    });
    const balloon = calculatePlan(plan, config).issues.find((issue) => issue.code === 'BALLOON_IN_HORIZON');
    expect(balloon).toMatchObject({ severity: 'info', params: { month: 24, amount: 1_000_000 } });
  });

  it('meldt posten die buiten de horizon vallen', () => {
    const plan = makePlan((draft) => {
      draft.need.investments = [
        {
          id: 'laat',
          description: 'Te late investering',
          category: 'bedrijfsmiddel',
          amountCents: 100_000,
          vatRateBp: 2100,
          lifeYears: 5,
          residualValueCents: 0,
          purchaseMonth: 60,
        },
      ];
      draft.need.oneOffCosts = [
        { id: 'laat', description: 'Late kosten', amountCents: 1000, vatRateBp: 2100, month: 60 },
      ];
      draft.need.grants = [{ id: 'laat', description: 'Late subsidie', amountCents: 1000, month: 60 }];
      draft.financing.lines = [
        {
          id: 'laat',
          kind: 'lening',
          description: 'Late lening',
          principalCents: 100_000,
          annualRateBp: 500,
          termMonths: 12,
          repayment: 'lineair',
          graceMonths: 0,
          startMonth: 60,
          isRequested: true,
        },
      ];
    });
    const outside = calculatePlan(plan, config).issues.filter((issue) => issue.code === 'MONTH_OUTSIDE_HORIZON');
    expect(outside.map((issue) => issue.path)).toEqual([
      'financing.lines.0.startMonth',
      'need.investments.0.purchaseMonth',
      'need.oneOffCosts.0.month',
      'need.grants.0.month',
    ]);
  });

  it('blijft zonder schuld zonder DSCR en zonder schuldratio', () => {
    const plan = makePlan((draft) => {
      draft.assumptions.revenue = { kind: 'maandbedrag', monthlyAmountCents: 100_000, monthlyGrowthBp: 0 };
    });
    const result = calculatePlan(plan, config);
    expect(result.ratios.dscr.every((ratio) => ratio.value === null && ratio.light === 'geen')).toBe(true);
    expect(result.ratios.debtToCashflow).toMatchObject({ value: null, light: 'geen' });
  });

  it('kleurt een schuld zonder kasstroom rood', () => {
    const plan = makePlan((draft) => {
      draft.need.workingCapitalCents = 1_000_000;
      draft.assumptions.fixedCosts = [
        { id: 'huur', category: 'huur', description: 'Huur', amountCents: 100_000, per: 'maand', vatRateBp: 0 },
      ];
      draft.financing.lines = [
        {
          id: 'lening',
          kind: 'lening',
          description: 'Lening',
          principalCents: 1_000_000,
          annualRateBp: 500,
          termMonths: 60,
          repayment: 'annuitair',
          graceMonths: 0,
          startMonth: 0,
          isRequested: true,
        },
      ];
    });
    const result = calculatePlan(plan, config);
    expect(result.ratios.debtToCashflow.light).toBe('rood');
    expect(result.ratios.dscr[0]?.light).toBe('rood');
    expect(result.ratios.breakEven[0]?.revenue).toBeNull();
  });

  it('kleurt een schuld van ruim drie jaar kasstroom oranje', () => {
    const plan = makePlan((draft) => {
      draft.need.workingCapitalCents = 12_000_000;
      draft.assumptions.revenue = { kind: 'maandbedrag', monthlyAmountCents: 300_000, monthlyGrowthBp: 0 };
      draft.financing.lines = [
        {
          id: 'lening',
          kind: 'lening',
          description: 'Lening',
          principalCents: 12_000_000,
          annualRateBp: 0,
          termMonths: 60,
          repayment: 'aflossingsvrij',
          graceMonths: 0,
          startMonth: 0,
          isRequested: true,
        },
      ];
    });
    const result = calculatePlan(plan, config);
    expect(result.ratios.debtToCashflow.value).toBeCloseTo(3.33, 2);
    expect(result.ratios.debtToCashflow.light).toBe('oranje');
  });

  it('boekt eenmalige kosten in de maand zelf', () => {
    const plan = makePlan((draft) => {
      draft.need.oneOffCosts = [
        { id: 'notaris', description: 'Notaris', amountCents: 150_000, vatRateBp: 2100, month: 0 },
      ];
      draft.need.ownContributionCents = 200_000;
    });
    const result = calculatePlan(plan, config);
    expect(result.pnl.monthly[0]?.oneOffCosts).toBe(150_000);
    expect(result.pnl.monthly[0]?.ebit).toBe(-150_000);
    expect(result.cashflow.monthly[0]?.payments.operations.oneOffCosts).toBe(181_500);
    expect(result.issues.map((issue) => issue.code)).not.toContain('MONTH_OUTSIDE_HORIZON');
  });

  it('kleurt een saldo onder de buffer oranje', () => {
    const plan = makePlan((draft) => {
      draft.need.ownContributionCents = 100_000;
      draft.assumptions.minimumCashBufferCents = 500_000;
    });
    const result = calculatePlan(plan, config);
    expect(result.ratios.lowestCash).toMatchObject({ amount: 100_000, month: 0, light: 'oranje' });
  });

  it('kleurt een ruim saldo groen', () => {
    const plan = makePlan((draft) => {
      draft.need.ownContributionCents = 1_000_000;
    });
    expect(calculatePlan(plan, config).ratios.lowestCash.light).toBe('groen');
  });
});

describe('voorraad en subsidie', () => {
  it('houdt voorraad op de balans en boekt een subsidie bij het eigen vermogen', () => {
    const plan = makePlan((draft) => {
      draft.need.investments = [
        {
          id: 'voorraad',
          description: 'Startvoorraad',
          category: 'voorraad',
          amountCents: 800_000,
          vatRateBp: 2100,
          lifeYears: null,
          residualValueCents: 0,
          purchaseMonth: 0,
        },
      ];
      draft.need.grants = [{ id: 'subsidie', description: 'Subsidie', amountCents: 800_000, month: 0 }];
    });
    const result = calculatePlan(plan, config);
    expect(result.balanceSheet.monthly[0]?.stock).toBe(800_000);
    expect(result.balanceSheet.monthly[0]?.equity).toBe(800_000);
    expect(at(result.depreciation[0]?.depreciation ?? [], 12)).toBe(0);
    expect(result.balanceSheet.monthly.every((sheet) => sheet.totalAssets === sheet.totalLiabilities)).toBe(true);
  });
});
