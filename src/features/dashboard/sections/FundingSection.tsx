import { Callout } from '../../../components/ui/Callout';
import { Card } from '../../../components/ui/Card';
import { FinancialTable, type FinancialRow } from '../../../components/ui/FinancialTable';
import type { PlanResult } from '../../../engine';
import { formatCents, formatYearMonth } from '../../../lib/format';

const CATEGORY_LABELS = {
  bedrijfsmiddel: 'Bedrijfsmiddelen',
  verbouwing: 'Verbouwing',
  voorraad: 'Voorraad',
  immaterieel: 'Immateriële activa',
  overig: 'Overig',
} as const;

export function FundingSection({ result }: { result: PlanResult }) {
  const { uses, sources, difference, vatOnInvestments } = result.financingNeed;

  const useRows: FinancialRow[] = [
    ...Object.entries(CATEGORY_LABELS)
      .filter(([key]) => uses.investmentsByCategory[key as keyof typeof CATEGORY_LABELS] > 0)
      .map(([key, label]): FinancialRow => ({
        label,
        values: [formatCents(uses.investmentsByCategory[key as keyof typeof CATEGORY_LABELS])],
        indent: true,
      })),
    { label: 'Investeringen', values: [formatCents(uses.investments)] },
    { label: 'Werkkapitaal', values: [formatCents(uses.workingCapital)] },
    { label: 'Eenmalige kosten', values: [formatCents(uses.oneOffCosts)] },
    { label: 'Totaal nodig', values: [formatCents(uses.total)], emphasis: true },
  ];

  const sourceRows: FinancialRow[] = [
    { label: 'Eigen inbreng', values: [formatCents(sources.ownContribution)] },
    { label: 'Subsidies en schenkingen', values: [formatCents(sources.grants)] },
    { label: 'Al geregelde financiering', values: [formatCents(sources.otherFinancing)] },
    { label: 'Aangevraagde financiering', values: [formatCents(sources.requestedFinancing)] },
    { label: 'Totaal beschikbaar', values: [formatCents(sources.total)], emphasis: true },
  ];

  const settlement = vatOnInvestments.settlements[0]?.settledInMonth ?? null;
  const settlementMeta = settlement === null ? undefined : result.meta.months[settlement];

  return (
    <Card title="Investering en financiering" description="Bronnen en bestedingen horen exact gelijk te zijn.">
      <div className="grid gap-6 lg:grid-cols-2">
        <FinancialTable columns={['Bedrag']} rows={useRows} rowHeader="Bestedingen" />
        <FinancialTable columns={['Bedrag']} rows={sourceRows} rowHeader="Bronnen" />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {difference !== 0 && (
          <Callout tone="error" title="Bronnen en bestedingen sluiten niet">
            {difference > 0
              ? `Er is ${formatCents(difference)} meer financiering dan nodig.`
              : `Er ontbreekt ${formatCents(-difference)} aan financiering.`}
          </Callout>
        )}
        {vatOnInvestments.total > 0 && (
          <Callout tone="info" title="Btw op je investeringen">
            Je schiet {formatCents(vatOnInvestments.total)} btw voor. Dat komt terug bij de aangifte
            {settlementMeta !== undefined
              ? ` in ${formatYearMonth(`${settlementMeta.year}-${String(settlementMeta.month).padStart(2, '0')}`)}`
              : ' na afloop van de prognose'}
            , maar tot die tijd moet het wel op je rekening staan.
          </Callout>
        )}
      </div>
    </Card>
  );
}
