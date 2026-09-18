/**
 * Maakt het dossier van de testcasus als pdf en Excel, zodat je de uitvoer kunt bekijken
 * zonder de wizard in te vullen:
 *
 *   npx vite-node scripts/exportSample.ts -- /pad/naar/map
 */
import { renderToBuffer } from '@react-pdf/renderer';
import { mkdir, writeFile } from 'node:fs/promises';
import { argv } from 'node:process';
import { defaultEngineConfig } from '../src/config';
import { buildAccuracy, calculatePlan } from '../src/engine';
import { jansenPlan } from '../src/engine/__tests__/fixtures/jansen';
import { createDemoCase } from '../src/demo/loodgieter';
import { buildWorkbook } from '../src/exports/excel/workbook';
import { DossierDocument } from '../src/exports/pdf/DossierDocument';
import { ProgressReport } from '../src/exports/pdf/ProgressReport';

// vite-node geeft zijn eigen argumenten door; pak het eerste absolute pad.
const target = argv.slice(2).find((argument) => argument.startsWith('/')) ?? 'dist/voorbeeld';
await mkdir(target, { recursive: true });

const result = calculatePlan(jansenPlan, defaultEngineConfig);

const pdf = await renderToBuffer(
  <DossierDocument input={jansenPlan} result={result} preparedOn="17 september 2026" />,
);
await writeFile(`${target}/loodgieter-jansen-financieringsdossier.pdf`, pdf);

const workbook = buildWorkbook(jansenPlan, result);
await writeFile(
  `${target}/loodgieter-jansen-financieringsdossier.xlsx`,
  Buffer.from(await workbook.xlsx.writeBuffer()),
);

// En de voortgangsrapportage van de voorbeeldcasus.
const demo = createDemoCase();
const demoResult = calculatePlan(demo.plan.input, defaultEngineConfig);
const accuracy = buildAccuracy(demo.versions, demo.actuals, {
  metric: 'omzet',
  comparison: 'baseline',
  toleranceBp: 1000,
  window: 6,
  legalForm: demo.plan.input.company.legalForm,
  horizonMonths: demoResult.meta.horizonMonths,
  startMonth: demo.plan.input.assumptions.startMonth,
  minimumCashBufferCents: demo.plan.input.assumptions.minimumCashBufferCents,
});

const progress = await renderToBuffer(
  <ProgressReport
    input={demo.plan.input}
    result={demoResult}
    accuracy={accuracy}
    months={demoResult.meta.months}
    metric="omzet"
    planName={demo.plan.name}
    preparedOn="5 maart 2028"
  />,
);
await writeFile(`${target}/loodgieter-jansen-voortgangsrapportage.pdf`, progress);

console.log(`Geschreven naar ${target}`);
