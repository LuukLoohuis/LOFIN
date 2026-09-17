import type { IssueCode } from '../engine';
import { formatCents, formatNumber } from '../lib/format';

/**
 * Waarom een financier naar een ratio kijkt, in gewone taal. Uitleggen wat een getal betekent
 * mag; zeggen wat iemand moet doen niet.
 */
export interface RatioHelp {
  title: string;
  what: string;
  why: string;
}

export const RATIO_HELP = {
  dscr: {
    title: 'DSCR',
    what: 'Je kasstroom gedeeld door wat je dat jaar aan rente en aflossing betaalt.',
    why: 'Een financier wil zien dat er na alle kosten en je eigen opnamen genoeg overblijft om de lening te betalen — met marge voor tegenvallers. Onder de 1,0 betaal je de lening uit je buffer.',
  },
  lowestCash: {
    title: 'Laagste kassaldo',
    what: 'Het diepste punt van je banksaldo in de hele prognose, en in welke maand dat valt.',
    why: 'De meeste ondernemingen komen niet om door verlies, maar doordat het geld op een dinsdag op is. Een financier kijkt of je die dip doorkomt.',
  },
  breakEven: {
    title: 'Break-evenomzet',
    what: 'De omzet waarbij je precies uit de kosten komt, inclusief afschrijving en rente.',
    why: 'Het laat zien hoeveel ruimte er tussen je prognose en je ondergrens zit. Ligt je break-even vlak onder je prognose, dan is er weinig speling.',
  },
  solvency: {
    title: 'Solvabiliteit',
    what: 'Je eigen vermogen als deel van alles wat er op de balans staat, aan het eind van elk boekjaar.',
    why: 'Hoe meer er van jezelf is, hoe meer tegenslag je kunt opvangen zonder dat de financier zijn geld kwijtraakt.',
  },
  debtToCashflow: {
    title: 'Schuld ten opzichte van je kasstroom',
    what: 'Je totale rentedragende schuld gedeeld door de kasstroom van je eerste volle boekjaar.',
    why: 'Grofweg: in hoeveel jaar zou je de hele schuld kunnen terugbetalen als je alles daaraan besteedde. Hoe lager, hoe meer lucht.',
  },
} as const satisfies Record<string, RatioHelp>;

/** Alle drempels zijn indicatief; elke financier weegt zelf. */
export const RATIO_DISCLAIMER = 'De stoplichten zijn indicatief. Elke financier hanteert eigen grenzen.';

const amount = (value: string | number | undefined) => formatCents(Number(value ?? 0));

export const ISSUE_MESSAGES: Record<IssueCode, (params: Record<string, string | number>) => string> = {
  SEASONALITY_INVALID: () => 'De twaalf seizoensmaanden komen niet samen op 12,00 uit (stap 4).',
  VAT_MIX_INVALID: () => 'De verdeling van je omzet over de btw-tarieven is geen 100% (stap 4).',
  FUNDING_IMBALANCE: (p) =>
    Number(p['difference']) > 0
      ? `Je hebt ${amount(p['difference'])} meer financiering dan je nodig hebt (stap 5).`
      : `Er ontbreekt nog ${formatCents(-Number(p['difference'] ?? 0))} aan financiering (stap 5).`,
  GRACE_TOO_LONG: (p) =>
    `Een aflossingsvrije periode van ${formatNumber(Number(p['graceMonths']))} maanden past niet in een looptijd van ${formatNumber(Number(p['termMonths']))} maanden (stap 5).`,
  MONTH_OUTSIDE_HORIZON: (p) =>
    `Maand ${formatNumber(Number(p['month']))} valt buiten de prognose; die post telt niet mee.`,
  NEGATIVE_CASH: (p) =>
    `Je saldo gaat in maand ${formatNumber(Number(p['month']))} onder nul, met ${amount(p['lowestAmount'])} als diepste punt.`,
  CREDIT_LIMIT_EXCEEDED: (p) =>
    `In maand ${formatNumber(Number(p['month']))} is je kredietlimiet niet genoeg: er ontbreekt ${amount(p['shortfall'])}.`,
  OPENING_BALANCE_MISMATCH: (p) =>
    `Je openingsbalans sluit niet: er staat ${amount(p['difference'])} verschil bij de overige schulden (stap 3).`,
  WITHDRAWALS_IGNORED_FOR_BV: () =>
    'Privé-opnamen tellen niet mee bij een bv. Neem je eigen loon op als personeelskosten (stap 4).',
  BALLOON_IN_HORIZON: (p) =>
    `In maand ${formatNumber(Number(p['month']))} moet je ${amount(p['amount'])} in één keer aflossen.`,
};

export const PERIOD_LABELS: Record<string, string> = {
  start: 'Startperiode',
  y1: 'Jaar 1',
  y2: 'Jaar 2',
  y3: 'Jaar 3',
};

export const SCENARIO_LABELS: Record<string, string> = {
  basis: 'Basis',
  pessimistisch: 'Pessimistisch',
  optimistisch: 'Optimistisch',
};
