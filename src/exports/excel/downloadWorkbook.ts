import type { PlanInput, PlanResult } from '../../engine';
import { slug } from '../pdf/renderDossier';

/** Het werkboek wordt in de browser gemaakt; je cijfers gaan niet naar een server. */
export async function downloadWorkbook(params: {
  input: PlanInput;
  result: PlanResult;
  planName: string;
}): Promise<void> {
  const { buildWorkbook } = await import('./workbook');
  const workbook = buildWorkbook(params.input, params.result);
  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug(params.planName)}-financieringsdossier.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
