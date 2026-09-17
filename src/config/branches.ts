import type { Bp } from '../engine/types/input';

export interface BranchPreset {
  id: string;
  label: string;
  /** Twaalf gewichten in honderdsten, januari eerst; samen 1200. Indicatief. */
  seasonality: readonly number[];
  costOfSalesBp: Bp;
  debtorDays: number;
  creditorDays: number;
  revenueModel: 'uurtarief' | 'opdrachten' | 'maandbedrag';
  note: string;
}

/** Wat je krijgt als je branche er niet bij staat. */
export const FALLBACK_BRANCH: BranchPreset = {
  id: 'overig',
  label: 'Overig',
  seasonality: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  costOfSalesBp: 3000,
  debtorDays: 30,
  creditorDays: 30,
  revenueModel: 'maandbedrag',
  note: 'Geen seizoenspatroon; pas het zelf aan.',
};

/** Startpunten per branche, altijd aan te passen. De percentages zijn indicatief. */
export const BRANCH_PRESETS: readonly BranchPreset[] = [
  {
    id: 'installateur',
    label: 'Installateur / loodgieter',
    seasonality: [95, 95, 100, 100, 100, 100, 85, 80, 105, 110, 115, 115],
    costOfSalesBp: 3500,
    debtorDays: 30,
    creditorDays: 30,
    revenueModel: 'opdrachten',
    note: 'Druk in het stookseizoen, rustig in de bouwvak.',
  },
  {
    id: 'bouw',
    label: 'Aannemer / bouwbedrijf',
    seasonality: [80, 85, 100, 105, 110, 110, 90, 70, 110, 115, 115, 110],
    costOfSalesBp: 4500,
    debtorDays: 30,
    creditorDays: 30,
    revenueModel: 'opdrachten',
    note: 'Vorstverlet en bouwvak drukken de omzet.',
  },
  {
    id: 'schilder',
    label: 'Schilder / stukadoor',
    seasonality: [70, 75, 95, 110, 120, 120, 105, 85, 115, 110, 100, 95],
    costOfSalesBp: 2000,
    debtorDays: 21,
    creditorDays: 30,
    revenueModel: 'opdrachten',
    note: 'Buitenwerk piekt in het voorjaar en de zomer.',
  },
  {
    id: 'hovenier',
    label: 'Hovenier',
    seasonality: [60, 65, 100, 125, 130, 125, 110, 95, 115, 110, 90, 75],
    costOfSalesBp: 3000,
    debtorDays: 21,
    creditorDays: 30,
    revenueModel: 'opdrachten',
    note: 'Sterk seizoen: winters zijn stil.',
  },
  {
    id: 'horeca',
    label: 'Horeca (café of restaurant)',
    seasonality: [80, 80, 90, 100, 110, 115, 120, 115, 105, 95, 85, 105],
    costOfSalesBp: 3000,
    debtorDays: 0,
    creditorDays: 14,
    revenueModel: 'maandbedrag',
    note: 'Gasten rekenen direct af; leveranciers betaal je later.',
  },
  {
    id: 'detailhandel',
    label: 'Winkel / detailhandel',
    seasonality: [85, 80, 90, 95, 100, 95, 90, 90, 95, 100, 110, 170],
    costOfSalesBp: 5500,
    debtorDays: 0,
    creditorDays: 30,
    revenueModel: 'maandbedrag',
    note: 'December is de maand van het jaar.',
  },
  {
    id: 'webshop',
    label: 'Webshop',
    seasonality: [95, 85, 90, 90, 90, 85, 85, 90, 95, 105, 130, 160],
    costOfSalesBp: 5000,
    debtorDays: 0,
    creditorDays: 30,
    revenueModel: 'maandbedrag',
    note: 'Black Friday en de feestdagen bepalen het jaar.',
  },
  {
    id: 'dienstverlening',
    label: 'Zakelijke dienstverlening / zzp',
    seasonality: [105, 105, 105, 100, 100, 95, 70, 75, 105, 110, 110, 120],
    costOfSalesBp: 0,
    debtorDays: 30,
    creditorDays: 14,
    revenueModel: 'uurtarief',
    note: 'Vakanties halen uren uit juli en augustus.',
  },
  {
    id: 'kapper',
    label: 'Kapper / schoonheidssalon',
    seasonality: [90, 90, 100, 100, 105, 105, 90, 90, 100, 105, 105, 120],
    costOfSalesBp: 1000,
    debtorDays: 0,
    creditorDays: 14,
    revenueModel: 'maandbedrag',
    note: 'Klanten betalen direct; december piekt.',
  },
  {
    id: 'transport',
    label: 'Transport / koerier',
    seasonality: [95, 95, 100, 100, 100, 100, 90, 90, 100, 105, 110, 115],
    costOfSalesBp: 1500,
    debtorDays: 30,
    creditorDays: 30,
    revenueModel: 'opdrachten',
    note: 'Brandstof en onderhoud zijn de grootste variabele kosten.',
  },
  FALLBACK_BRANCH,
];
