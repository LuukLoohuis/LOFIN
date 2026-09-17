import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../core/calendar';
import { sum } from '../core/money';
import { annuityPayment, buildLoanSchedules, buildSchedule, isCreditLine, type LoanTerms } from '../plan/loans';
import type { RepaymentType } from '../types/input';

const HORIZON = 61;

const terms = (overrides: Partial<LoanTerms>): LoanTerms => ({
  principalCents: 5_000_000,
  annualRateBp: 700,
  termMonths: 60,
  graceMonths: 0,
  repayment: 'annuitair',
  startMonth: 0,
  isNew: true,
  ...overrides,
});

describe('annuityPayment', () => {
  it('rekent de annuïteit uit de testcasus', () => {
    expect(annuityPayment(5_000_000, 700, 60)).toBe(99_006);
  });

  it('deelt zonder rente gewoon door de looptijd', () => {
    expect(annuityPayment(1_200_000, 0, 12)).toBe(100_000);
  });
});

describe('buildSchedule — annuïtair', () => {
  const { rows, annuityPayment: payment, linearPrincipal } = buildSchedule(terms({}), HORIZON);
  const year1 = rows.slice(1, 13);

  it('betaalt elke maand hetzelfde bedrag, behalve de laatste', () => {
    expect(payment).toBe(99_006);
    expect(linearPrincipal).toBeNull();
    expect(year1.every((row) => row.interest + row.principal === 99_006)).toBe(true);
  });

  it('komt in jaar 1 op de rente en aflossing uit de testcasus', () => {
    expect(sum(year1.map((row) => row.interest))).toBe(322_580);
    expect(sum(year1.map((row) => row.principal))).toBe(865_492);
    // De specificatie noemt 3.225,82 en 8.654,90: dat is dezelfde reeks zonder maandelijkse afronding.
    expect(sum(year1.map((row) => row.interest)) / 100).toBeCloseTo(3225.82, 1);
    expect(sum(year1.map((row) => row.principal)) / 100).toBeCloseTo(8654.9, 1);
  });

  it('lost precies af: de laatste termijn vangt het afrondingsverschil op', () => {
    const last = rows[60];
    expect(last?.closingBalance).toBe(0);
    expect((last?.interest ?? 0) + (last?.principal ?? 0)).toBe(99_001);
    expect(sum(rows.map((row) => row.principal))).toBe(5_000_000);
    expect(rows[0]?.drawdown).toBe(5_000_000);
  });
});

describe('buildSchedule — lineair', () => {
  const { rows, linearPrincipal } = buildSchedule(
    terms({ principalCents: 1_200_000, annualRateBp: 600, termMonths: 12, repayment: 'lineair' }),
    HORIZON,
  );

  it('lost elke maand hetzelfde bedrag af', () => {
    expect(linearPrincipal).toBe(100_000);
    expect(rows.slice(1, 13).every((row) => row.principal === 100_000)).toBe(true);
    expect(rows[1]?.interest).toBe(6000);
    expect(sum(rows.map((row) => row.interest))).toBe(39_000);
    expect(rows[12]?.closingBalance).toBe(0);
  });
});

describe('buildSchedule — aflossingsvrije periode', () => {
  it('betaalt eerst alleen rente en lost daarna in de resterende maanden af', () => {
    const { rows, annuityPayment: payment } = buildSchedule(
      terms({ principalCents: 1_000_000, annualRateBp: 600, termMonths: 24, graceMonths: 6 }),
      HORIZON,
    );
    expect(payment).toBe(58_232);
    expect(rows.slice(1, 7).every((row) => row.principal === 0 && row.interest === 5000)).toBe(true);
    expect((rows[7]?.principal ?? 0) + (rows[7]?.interest ?? 0)).toBe(58_232);
    expect(rows[24]?.closingBalance).toBe(0);
    expect(sum(rows.map((row) => row.principal))).toBe(1_000_000);
  });

  it('werkt ook lineair', () => {
    const { rows, linearPrincipal } = buildSchedule(
      terms({ principalCents: 1_200_000, annualRateBp: 600, termMonths: 18, graceMonths: 6, repayment: 'lineair' }),
      HORIZON,
    );
    expect(linearPrincipal).toBe(100_000);
    expect(rows.slice(1, 7).every((row) => row.principal === 0)).toBe(true);
    expect(rows[7]?.principal).toBe(100_000);
    expect(rows[18]?.closingBalance).toBe(0);
  });

  it('wordt een slottermijn als de aflossingsvrije periode de hele looptijd beslaat', () => {
    const { rows, annuityPayment: payment, linearPrincipal } = buildSchedule(
      terms({ principalCents: 1_000_000, annualRateBp: 600, termMonths: 12, graceMonths: 12 }),
      HORIZON,
    );
    expect(payment).toBeNull();
    expect(linearPrincipal).toBeNull();
    expect(rows[12]?.principal).toBe(1_000_000);
  });
});

describe('buildSchedule — aflossingsvrij', () => {
  it('betaalt alleen rente en aan het eind de hoofdsom', () => {
    const { rows } = buildSchedule(
      terms({ principalCents: 2_000_000, annualRateBp: 500, termMonths: 24, repayment: 'aflossingsvrij' }),
      HORIZON,
    );
    expect(rows.slice(1, 24).every((row) => row.interest === 8333 && row.principal === 0)).toBe(true);
    expect(rows[24]?.principal).toBe(2_000_000);
    expect(rows[24]?.closingBalance).toBe(0);
  });
});

describe('buildSchedule — bestaande schuld', () => {
  it('begint met het openstaande saldo zonder uitbetaling', () => {
    const { rows } = buildSchedule(
      terms({ principalCents: 900_000, annualRateBp: 400, termMonths: 36, repayment: 'lineair', isNew: false }),
      HORIZON,
    );
    expect(rows[0]).toMatchObject({ openingBalance: 900_000, drawdown: 0, closingBalance: 900_000 });
    expect(rows[36]?.closingBalance).toBe(0);
  });
});

describe('buildLoanSchedules', () => {
  const timeline = buildTimeline({ year: 2027, month: 1 });

  it('zet nieuwe regels en bestaande schulden om in schema’s', () => {
    const schedules = buildLoanSchedules(
      {
        lines: [
          {
            id: 'lening',
            kind: 'lening',
            description: 'Lening',
            principalCents: 1_200_000,
            annualRateBp: 600,
            termMonths: 12,
            repayment: 'lineair',
            graceMonths: 0,
            startMonth: 0,
            isRequested: true,
          },
          {
            id: 'achtergesteld',
            kind: 'achtergestelde_lening',
            description: 'Lening van familie',
            principalCents: 500_000,
            annualRateBp: 300,
            termMonths: 60,
            repayment: 'aflossingsvrij',
            graceMonths: 0,
            startMonth: 0,
            isRequested: false,
          },
          {
            id: 'krediet',
            kind: 'krediet',
            description: 'Rekening-courant',
            limitCents: 1_000_000,
            annualRateBp: 900,
            startMonth: 0,
            isRequested: true,
          },
        ],
        existingDebts: [
          {
            id: 'oud',
            description: 'Lopende lening',
            outstandingCents: 600_000,
            annualRateBp: 400,
            remainingMonths: 24,
            repayment: 'lineair',
          },
        ],
        financierTypes: ['bank'],
      },
      timeline,
    );

    expect(schedules.map((schedule) => schedule.lineId)).toEqual(['lening', 'achtergesteld', 'oud']);
    expect(schedules[1]?.subordinated).toBe(true);
    expect(schedules[2]).toMatchObject({ origin: 'bestaand', kind: 'bestaande_schuld' });
    expect(schedules[0]?.periods.map((period) => period.period)).toEqual(['y1', 'y2', 'y3']);
    expect(schedules[0]?.periods[0]?.principal).toBe(1_200_000);
    expect(schedules[0]?.periods[0]?.closingBalance).toBe(0);
  });

  it('herkent een krediet', () => {
    expect(
      isCreditLine({
        id: 'k',
        kind: 'krediet',
        description: '',
        limitCents: 1,
        annualRateBp: 1,
        startMonth: 0,
        isRequested: true,
      }),
    ).toBe(true);
  });
});

describe('buildSchedule — eigenschappen', () => {
  it('eindigt altijd op nul en lost precies de hoofdsom af', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000_000 }),
        fc.integer({ min: 0, max: 2500 }),
        fc.integer({ min: 1, max: 120 }),
        fc.integer({ min: 0, max: 119 }),
        fc.constantFrom<RepaymentType>('annuitair', 'lineair', 'aflossingsvrij'),
        fc.integer({ min: 0, max: 6 }),
        (principalCents, annualRateBp, termMonths, graceMonths, repayment, startMonth) => {
          const length = startMonth + termMonths + 1;
          const { rows } = buildSchedule(
            {
              principalCents,
              annualRateBp,
              termMonths,
              graceMonths: Math.min(graceMonths, termMonths),
              repayment,
              startMonth,
              isNew: true,
            },
            length,
          );
          const last = rows[length - 1];
          expect(last?.closingBalance).toBe(0);
          expect(sum(rows.map((row) => row.principal))).toBe(principalCents);
          expect(rows.every((row) => row.principal >= 0 && row.interest >= 0)).toBe(true);
          expect(rows.every((row) => row.closingBalance >= 0)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
