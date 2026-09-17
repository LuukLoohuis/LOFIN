import { describe, expect, it } from 'vitest';
import { createDefaultPlanInput } from '../../data/defaultPlan';
import { toFieldErrors } from '../../features/wizard/errors';
import { isStepComplete } from '../../features/wizard/usePlan';
import { companySchema } from '../company';
import { planInputSchema, validateStep, WIZARD_STEPS } from '../plan';

const [stepCompany, stepNeed, stepHistory, stepAssumptions, stepFinancing, stepExplanations] = WIZARD_STEPS;

describe('planInputSchema', () => {
  it('mist bij een vers plan alleen nog de bedrijfsnaam', () => {
    const result = planInputSchema.safeParse(createDefaultPlanInput('2027-01'));
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))).toEqual(['company.name']);
  });

  it('keurt een ingevuld plan goed', () => {
    const plan = createDefaultPlanInput('2027-01');
    plan.company.name = 'Loodgieter Jansen';
    expect(planInputSchema.safeParse(plan).success).toBe(true);
  });

  it('weigert een startmaand die geen maand is', () => {
    const plan = createDefaultPlanInput('2027-13');
    expect(planInputSchema.safeParse(plan).success).toBe(false);
  });
});

describe('companySchema', () => {
  it('laat een leeg kvk-nummer toe maar geen half nummer', () => {
    const base = createDefaultPlanInput('2027-01').company;
    expect(companySchema.safeParse({ ...base, name: 'Jansen', kvkNumber: '' }).success).toBe(true);
    expect(companySchema.safeParse({ ...base, name: 'Jansen', kvkNumber: '12345678' }).success).toBe(true);
    expect(companySchema.safeParse({ ...base, name: 'Jansen', kvkNumber: '123' }).success).toBe(false);
  });
});

describe('validateStep', () => {
  it('meldt seizoensgewichten die niet op 12 uitkomen', () => {
    const plan = createDefaultPlanInput('2027-01');
    plan.assumptions.seasonality = [...plan.assumptions.seasonality];
    plan.assumptions.seasonality[0] = 150;
    const errors = toFieldErrors(validateStep(stepAssumptions, plan), plan.assumptions);
    expect(errors['seasonality']).toBe('De twaalf maanden moeten samen op 12,00 uitkomen');
  });

  it('meldt een aflossingsvrije periode die niet korter is dan de looptijd', () => {
    const plan = createDefaultPlanInput('2027-01');
    plan.financing.lines = [
      {
        id: 'lening',
        kind: 'lening',
        description: 'Lening',
        principalCents: 1_000_000,
        annualRateBp: 700,
        termMonths: 12,
        repayment: 'annuitair',
        graceMonths: 12,
        startMonth: 0,
        isRequested: true,
      },
    ];
    const errors = toFieldErrors(validateStep(stepFinancing, plan), plan.financing);
    expect(errors['lines.0.graceMonths']).toContain('korter zijn dan de looptijd');
  });

  it('kleurt lege velden niet rood', () => {
    const plan = createDefaultPlanInput('2027-01');
    const errors = toFieldErrors(validateStep(stepCompany, plan), plan.company);
    expect(errors).toEqual({});
  });

  it('kleurt een half ingevuld veld wel rood', () => {
    const plan = createDefaultPlanInput('2027-01');
    plan.company.name = 'J';
    const errors = toFieldErrors(validateStep(stepCompany, plan), plan.company);
    expect(errors['name']).toBe('Vul de naam van je onderneming in');
  });
});

describe('isStepComplete', () => {
  it('is pas af als er ook echt iets staat', () => {
    const plan = createDefaultPlanInput('2027-01');
    expect(isStepComplete(stepCompany, plan)).toBe(false);

    plan.company.name = 'Loodgieter Jansen';
    plan.company.description = 'Loodgietersbedrijf voor particulieren.';
    expect(isStepComplete(stepCompany, plan)).toBe(true);
  });

  it('slaat de historie over bij een starter', () => {
    const plan = createDefaultPlanInput('2027-01');
    expect(isStepComplete(stepHistory, plan)).toBe(true);

    plan.company.isStarter = false;
    expect(isStepComplete(stepHistory, plan)).toBe(false);
  });

  it('telt de financieringsbehoefte, omzet, financiering en toelichting mee', () => {
    const plan = createDefaultPlanInput('2027-01');
    expect(isStepComplete(stepNeed, plan)).toBe(false);
    plan.need.workingCapitalCents = 1_000_000;
    expect(isStepComplete(stepNeed, plan)).toBe(true);

    expect(isStepComplete(stepAssumptions, plan)).toBe(false);
    plan.assumptions.revenue = { kind: 'maandbedrag', monthlyAmountCents: 1_250_000, monthlyGrowthBp: 0 };
    expect(isStepComplete(stepAssumptions, plan)).toBe(true);

    expect(isStepComplete(stepFinancing, plan)).toBe(false);
    plan.financing.lines = [
      {
        id: 'krediet',
        kind: 'krediet',
        description: 'Rekening-courant',
        limitCents: 1_000_000,
        annualRateBp: 900,
        startMonth: 0,
        isRequested: true,
      },
    ];
    plan.financing.financierTypes = ['bank'];
    expect(isStepComplete(stepFinancing, plan)).toBe(true);

    expect(isStepComplete(stepExplanations, plan)).toBe(false);
    plan.explanations = {
      ondernemer: 'x',
      markt: 'x',
      investering: 'x',
      opbrengst: 'x',
      risicos: 'x',
      zekerheden: 'x',
    };
    expect(isStepComplete(stepExplanations, plan)).toBe(true);
  });
});
