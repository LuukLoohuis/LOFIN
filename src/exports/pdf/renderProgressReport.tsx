import type { AccuracyResult, MetricKey, MonthMeta, PlanInput, PlanResult } from '../../engine';
import { slug } from './renderDossier';

/** Ook deze rapportage wordt in de browser gemaakt; de cijfers gaan niet naar een server. */
export async function downloadProgressReport(params: {
  input: PlanInput;
  result: PlanResult;
  accuracy: AccuracyResult;
  months: readonly MonthMeta[];
  metric: MetricKey;
  planName: string;
  preparedOn: string;
}): Promise<void> {
  const [{ pdf }, { ProgressReport }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./ProgressReport'),
  ]);

  const blob = await pdf(<ProgressReport {...params} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug(params.planName)}-voortgangsrapportage.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
