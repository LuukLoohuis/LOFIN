import { Card } from '../../../components/ui/Card';
import { FinancialTable, type FinancialRow } from '../../../components/ui/FinancialTable';
import { PERIOD_LABELS } from '../../../config/texts';
import type { PlanResult } from '../../../engine';
import { formatCents, formatNumber, formatPercent } from '../../../lib/format';

const KIND_LABELS: Record<string, string> = {
  lening: 'Lening',
  lease: 'Lease',
  achtergestelde_lening: 'Achtergestelde lening',
  bestaande_schuld: 'Lopende lening',
};

export function LoansSection({ result }: { result: PlanResult }) {
  if (result.loans.length === 0 && result.creditLines.length === 0) return null;

  const columns = result.meta.periods.map((period) => PERIOD_LABELS[period.key] ?? period.key);

  return (
    <Card title="Aflossingen" description="Per financieringsregel: wat je per boekjaar aan rente en aflossing betaalt.">
      <div className="flex flex-col gap-6">
        {result.loans.map((loan) => {
          const rows: FinancialRow[] = [
            { label: 'Rente', values: loan.periods.map((period) => formatCents(period.interest)) },
            { label: 'Aflossing', values: loan.periods.map((period) => formatCents(period.principal)) },
            {
              label: 'Restschuld per 31-12',
              values: loan.periods.map((period) => formatCents(period.closingBalance)),
              emphasis: true,
            },
          ];

          return (
            <section key={loan.lineId}>
              <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {loan.description === '' ? (KIND_LABELS[loan.kind] ?? loan.kind) : loan.description}
                  <span className="ml-2 text-xs font-normal text-slate-500">{KIND_LABELS[loan.kind] ?? loan.kind}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {formatCents(loan.principal)} · {formatPercent(loan.annualRateBp)} ·{' '}
                  {formatNumber(loan.termMonths)} maanden
                  {loan.annuityPayment !== null && <> · termijn {formatCents(loan.annuityPayment)} per maand</>}
                  {loan.linearPrincipal !== null && <> · aflossing {formatCents(loan.linearPrincipal)} per maand</>}
                </p>
              </header>
              <FinancialTable columns={columns} rows={rows} rowHeader="Post" />
            </section>
          );
        })}

        {result.creditLines.map((credit) => {
          const rows: FinancialRow[] = [
            { label: 'Rente over de roodstand', values: credit.periods.map((period) => formatCents(period.interest)) },
            {
              label: 'Opgenomen per 31-12',
              values: credit.periods.map((period) => formatCents(period.closingBalance)),
              emphasis: true,
            },
          ];
          return (
            <section key={credit.lineId}>
              <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {credit.description === '' ? 'Rekening-courantkrediet' : credit.description}
                  <span className="ml-2 text-xs font-normal text-slate-500">Krediet</span>
                </h3>
                <p className="text-xs text-slate-500">
                  limiet {formatCents(credit.limit)} · {formatPercent(credit.annualRateBp)}
                </p>
              </header>
              <FinancialTable columns={columns} rows={rows} rowHeader="Post" />
            </section>
          );
        })}
      </div>
    </Card>
  );
}
