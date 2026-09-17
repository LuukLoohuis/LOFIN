import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { defaultEngineConfig } from '../../config';
import { calculatePlan } from '../../engine';
import { jansenPlan } from '../../engine/__tests__/fixtures/jansen';
import { DossierDocument } from '../pdf/DossierDocument';
import { slug } from '../pdf/renderDossier';

const result = calculatePlan(jansenPlan, defaultEngineConfig);

describe('Financieringsdossier als pdf', () => {
  it('rendert een pdf met meerdere pagina’s', async () => {
    const buffer = await renderToBuffer(
      <DossierDocument input={jansenPlan} result={result} preparedOn="17 september 2026" />,
    );

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(10_000);

    // De disclaimer staat als tekst in het bestand; pdf-tekst is samengeperst, dus we
    // controleren de omvang en de paginastructuur.
    const text = buffer.toString('latin1');
    expect(text).toContain('/Type /Page');
    expect(text.split('/Type /Page').length - 1).toBeGreaterThanOrEqual(6);
  }, 30_000);
});

describe('bestandsnaam', () => {
  it('maakt een nette slug van de plannaam', () => {
    expect(slug('Bus en gereedschap 2027')).toBe('bus-en-gereedschap-2027');
    expect(slug('Café René')).toBe('cafe-rene');
    expect(slug('   ')).toBe('plan');
  });
});
