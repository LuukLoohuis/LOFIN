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
import { calculatePlan } from '../src/engine';
import { jansenPlan } from '../src/engine/__tests__/fixtures/jansen';
import { buildWorkbook } from '../src/exports/excel/workbook';
import { DossierDocument } from '../src/exports/pdf/DossierDocument';

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

console.log(`Geschreven naar ${target}`);
