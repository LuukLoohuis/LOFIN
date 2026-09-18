import { describe, expect, it } from 'vitest';
import { applyMapping, parseCsv, parseMonthCell, suggestMapping } from '../csv';

const EXPORT = `Periode;Omzet;Inkoopwaarde;Huur;Personeel;Privé-opnamen;Rente;Aflossing;Banksaldo
2027-01;12.500,00;-4.375,00;-500,00;0,00;-3.800,00;-291,67;-698,39;1.250,00
2027-02;11.800,00;-4.130,00;-500,00;0,00;-3.800,00;-287,60;-702,46;980,00
2027-03;14.200,00;-4.970,00;-500,00;0,00;-3.800,00;-283,50;-706,56;1.410,00`;

describe('parseCsv', () => {
  it('leest kolomkoppen en regels, ook met puntkomma’s', () => {
    const table = parseCsv(EXPORT);
    expect(table.headers[0]).toBe('Periode');
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0]?.['Omzet']).toBe('12.500,00');
  });
});

describe('suggestMapping', () => {
  it('herkent de bekende kolommen', () => {
    const mapping = suggestMapping(parseCsv(EXPORT).headers);
    expect(mapping.monthColumn).toBe('Periode');
    expect(mapping.columns.omzet).toBe('Omzet');
    expect(mapping.columns.inkoopwaarde).toBe('Inkoopwaarde');
    expect(mapping.columns.priveOpnamen).toBe('Privé-opnamen');
    expect(mapping.columns.eindsaldo).toBe('Banksaldo');
  });

  it('valt terug op de eerste kolom als er geen periode in staat', () => {
    const mapping = suggestMapping(['Van', 'Omzet']);
    expect(mapping.monthColumn).toBe('Van');
  });

  it('gebruikt de maandkolom nooit ook als bedrag', () => {
    const mapping = suggestMapping(['Maand omzet', 'Iets anders']);
    expect(mapping.monthColumn).toBe('Maand omzet');
    expect(mapping.columns.omzet).toBeUndefined();
  });
});

describe('parseMonthCell', () => {
  it('herkent de gangbare schrijfwijzen', () => {
    expect(parseMonthCell('2027-03')).toEqual({ year: 2027, month: 3 });
    expect(parseMonthCell('2027-03-31')).toEqual({ year: 2027, month: 3 });
    expect(parseMonthCell('03-2027')).toEqual({ year: 2027, month: 3 });
    expect(parseMonthCell('maart 2027')).toEqual({ year: 2027, month: 3 });
    expect(parseMonthCell('mrt-2027')).toBeNull();
  });

  it('weigert onzin en onmogelijke maanden', () => {
    expect(parseMonthCell('')).toBeNull();
    expect(parseMonthCell('2027-13')).toBeNull();
    expect(parseMonthCell('13-2027')).toBeNull();
    expect(parseMonthCell('ergens in het voorjaar')).toBeNull();
  });
});

describe('applyMapping', () => {
  const table = parseCsv(EXPORT);
  const mapping = suggestMapping(table.headers);

  it('zet de regels om in maanden van de prognose', () => {
    const { months, skipped } = applyMapping(table, mapping, '2027-01', 36);
    expect(skipped).toEqual([]);
    expect(months).toHaveLength(3);
    expect(months[0]).toMatchObject({ month: 1, status: 'open', source: 'csv' });
    expect(months[0]?.values.omzet).toBe(1_250_000);
    // Kosten staan negatief in de export; wij tellen ze positief.
    expect(months[0]?.values.inkoopwaarde).toBe(437_500);
    expect(months[0]?.values.priveOpnamen).toBe(380_000);
    expect(months[0]?.values.eindsaldo).toBe(125_000);
    expect(months[2]?.month).toBe(3);
  });

  it('houdt een negatief banksaldo negatief', () => {
    const negative = parseCsv('Periode;Banksaldo\n2027-02;-1.500,00');
    const { months } = applyMapping(negative, suggestMapping(negative.headers), '2027-01', 36);
    expect(months[0]?.values.eindsaldo).toBe(-150_000);
  });

  it('meldt regels die buiten de prognose vallen', () => {
    const { months, skipped } = applyMapping(table, mapping, '2028-01', 36);
    expect(months).toHaveLength(0);
    expect(skipped[0]?.reason).toContain('valt buiten je prognose');
  });

  it('meldt regels zonder leesbare maand of zonder bedragen', () => {
    const rommel = parseCsv('Periode;Omzet\nergens;100\n2027-01;\n2027-02;geen getal');
    const { months, skipped } = applyMapping(rommel, suggestMapping(rommel.headers), '2027-01', 36);
    expect(months).toHaveLength(0);
    expect(skipped.map((entry) => entry.reason)).toEqual([
      'Geen maand gevonden in de kolom met de periode',
      'Geen bedragen gevonden',
      "'geen getal' in kolom Omzet is geen bedrag",
      'Geen bedragen gevonden',
    ]);
  });

  it('weigert een plan met een onmogelijke startmaand', () => {
    const { skipped } = applyMapping(table, mapping, 'geen maand', 36);
    expect(skipped[0]?.reason).toContain('startmaand');
  });
});
