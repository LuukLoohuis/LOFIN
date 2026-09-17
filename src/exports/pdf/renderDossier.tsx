import type { PlanInput, PlanResult } from '../../engine';

/**
 * De pdf wordt in de browser gemaakt: je dossier verlaat je apparaat niet.
 * React-pdf is groot, dus het wordt pas geladen als je echt downloadt.
 */
export async function downloadDossierPdf(params: {
  input: PlanInput;
  result: PlanResult;
  planName: string;
  preparedOn: string;
}): Promise<void> {
  const [{ pdf }, { DossierDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./DossierDocument'),
  ]);

  const blob = await pdf(
    <DossierDocument input={params.input} result={params.result} preparedOn={params.preparedOn} />,
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug(params.planName)}-financieringsdossier.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function slug(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return normalized === '' ? 'plan' : normalized;
}
