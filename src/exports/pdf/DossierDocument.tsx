import { Document, Page, Text, View } from '@react-pdf/renderer';
import { DISCLAIMER } from '../../config';
import { PERIOD_LABELS, RATIO_DISCLAIMER, SCENARIO_LABELS } from '../../config/texts';
import type { PlanInput, PlanResult } from '../../engine';
import { formatCents, formatNumber, formatPercent, formatYearMonth } from '../../lib/format';
import {
  cashflowMonthlyTable,
  cashflowQuarterlyTable,
  firstYearMonths,
  fundingTables,
  loanTables,
  pnlTable,
  type AmountTable,
} from '../tables';
import { Footer, KeyNumbers, Section, Table, type PdfRow } from './components';
import { styles } from './styles';

const LEGAL_FORM_LABELS: Record<string, string> = {
  eenmanszaak: 'Eenmanszaak',
  vof: 'Vennootschap onder firma',
  bv: 'Besloten vennootschap',
};

const EXPLANATION_TITLES = {
  ondernemer: 'Over de ondernemer',
  markt: 'Markt en klanten',
  investering: 'Waarom deze investering',
  opbrengst: 'Wat het oplevert',
  risicos: 'Risico’s en hoe ze worden opgevangen',
  zekerheden: 'Zekerheden',
} as const;

const SECTIONS = [
  'Samenvatting',
  'Toelichting van de ondernemer',
  'Investering en financiering',
  'Exploitatiebegroting',
  'Liquiditeitsbegroting',
  'Aflossingen',
  'Ratio’s',
  'Scenario’s',
  'Aannames',
  'Documenten',
];

/** Bedragen worden hier pas tekst; de cijfers komen onbewerkt uit de rekenkern. */
function toRows(table: AmountTable, hideEmpty = true): PdfRow[] {
  return table.rows
    .filter((row) => row.emphasis === true || !hideEmpty || row.amounts.some((amount) => amount !== 0))
    .map((row) => ({
      label: row.label,
      values: row.amounts.map(formatCents),
      ...(row.emphasis === undefined ? {} : { emphasis: row.emphasis }),
      ...(row.indent === undefined ? {} : { indent: row.indent }),
    }));
}

export interface DossierProps {
  input: PlanInput;
  result: PlanResult;
  /** Datum van opstellen, 'YYYY-MM-DD'. De rekenkern kent geen klok. */
  preparedOn: string;
}

export function DossierDocument({ input, result, preparedOn }: DossierProps) {
  const funding = fundingTables(result);
  const year1 = result.pnl.periods.find((row) => row.period === 'y1');
  const dscr = result.ratios.dscr.find((ratio) => ratio.period === 'y1');
  const lowestMonth = result.meta.months[result.ratios.lowestCash.month];
  const monthsYear1 = firstYearMonths(result);
  const quarterly = cashflowQuarterlyTable(result, monthsYear1.length);

  return (
    <Document
      title={`Financieringsdossier ${input.company.name}`}
      author={input.company.name}
      subject="Financieringsaanvraag"
      creator="LOFI"
      producer="LOFI"
    >
      <Page size="A4" style={styles.coverPage}>
        <View>
          <Text style={styles.coverLabel}>Financieringsdossier</Text>
          <Text style={styles.coverTitle}>{input.company.name === '' ? 'Naamloze onderneming' : input.company.name}</Text>
          <Text style={styles.coverCompany}>
            {LEGAL_FORM_LABELS[input.company.legalForm] ?? input.company.legalForm}
            {input.company.kvkNumber !== '' && ` · KvK ${input.company.kvkNumber}`}
          </Text>
          <Text style={styles.coverMeta}>
            Financieringsbehoefte {formatCents(result.financingNeed.financingNeed)} · prognose vanaf{' '}
            {formatYearMonth(input.assumptions.startMonth)}
          </Text>
          <Text style={styles.coverMeta}>Opgesteld op {preparedOn}</Text>
        </View>

        <View>
          <Text style={styles.subheading}>Inhoud</Text>
          {SECTIONS.map((section, index) => (
            <View key={section} style={styles.tocItem}>
              <Text>{section}</Text>
              <Text style={{ color: '#64748b' }}>{index + 1}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footerText}>{DISCLAIMER}</Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Samenvatting" intro={input.company.description}>
          <KeyNumbers
            items={[
              { label: 'Financieringsbehoefte', value: formatCents(result.financingNeed.financingNeed) },
              { label: 'Omzet jaar 1', value: formatCents(year1?.revenue ?? 0) },
              {
                label: 'DSCR jaar 1',
                value: dscr?.value == null ? '—' : formatNumber(dscr.value, 2),
                note: 'indicatief',
              },
              {
                label: 'Laagste kassaldo',
                value: formatCents(result.ratios.lowestCash.amount),
                note:
                  lowestMonth === undefined
                    ? undefined
                    : formatYearMonth(`${lowestMonth.year}-${String(lowestMonth.month).padStart(2, '0')}`),
              },
            ]}
          />
        </Section>

        <Section title="Toelichting van de ondernemer">
          {Object.entries(EXPLANATION_TITLES).map(([key, title]) => {
            const text = input.explanations[key as keyof typeof EXPLANATION_TITLES];
            if (text.trim() === '') return null;
            return (
              <View key={key}>
                <Text style={styles.subheading}>{title}</Text>
                <Text style={styles.paragraph}>{text}</Text>
              </View>
            );
          })}
        </Section>
        <Footer disclaimer={DISCLAIMER} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section
          title="Investering en financiering"
          intro="Bronnen en bestedingen op de startdatum van de prognose."
        >
          <Table columns={funding.uses.columns} rows={toRows(funding.uses)} rowHeader={funding.uses.rowHeader} />
          <View style={{ height: 14 }} />
          <Table
            columns={funding.sources.columns}
            rows={toRows(funding.sources)}
            rowHeader={funding.sources.rowHeader}
          />
        </Section>

        <Section title="Exploitatiebegroting" intro="Bedragen exclusief btw, per boekjaar.">
          <Table columns={pnlTable(result).columns} rows={toRows(pnlTable(result))} rowHeader="Post" />
        </Section>
        <Footer disclaimer={DISCLAIMER} />
      </Page>

      <Page size="A4" orientation="landscape" style={styles.page}>
        <Section title="Liquiditeitsbegroting" intro="Per maand in het eerste jaar, inclusief btw.">
          <Table
            columns={cashflowMonthlyTable(result, monthsYear1).columns}
            rows={toRows(cashflowMonthlyTable(result, monthsYear1))}
            rowHeader="Kasstroom"
          />
        </Section>
        <Footer disclaimer={DISCLAIMER} />
      </Page>

      <Page size="A4" orientation="landscape" style={styles.page}>
        <Section title="Liquiditeitsbegroting, jaar 2 en 3" intro="Per kwartaal.">
          <Table columns={quarterly.columns} rows={toRows(quarterly)} rowHeader="Kasstroom" />
        </Section>
        <Footer disclaimer={DISCLAIMER} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Aflossingen">
          {loanTables(result).map((loan) => (
            <View key={loan.title} style={{ marginBottom: 12 }}>
              <Text style={styles.subheading}>
                {loan.title} <Text style={{ color: '#64748b' }}>({loan.subtitle})</Text>
              </Text>
              <Table columns={loan.table.columns} rows={toRows(loan.table, false)} rowHeader="Post" />
            </View>
          ))}
        </Section>

        <Section title="Ratio’s" intro={RATIO_DISCLAIMER}>
          <Table
            columns={result.ratios.dscr.map((ratio) => PERIOD_LABELS[ratio.period] ?? ratio.period)}
            rowHeader="Ratio"
            rows={[
              {
                label: 'DSCR',
                values: result.ratios.dscr.map((ratio) => (ratio.value === null ? '—' : formatNumber(ratio.value, 2))),
              },
              {
                label: 'Solvabiliteit',
                values: result.ratios.solvency.map((ratio) =>
                  ratio.value === null ? '—' : formatPercent(Math.round(ratio.value * 10_000), 0),
                ),
              },
              {
                label: 'Break-evenomzet',
                values: result.ratios.breakEven.map((row) => (row.revenue === null ? '—' : formatCents(row.revenue))),
              },
            ]}
          />
          <Text style={styles.paragraph}>
            Laagste kassaldo {formatCents(result.ratios.lowestCash.amount)}
            {lowestMonth !== undefined &&
              ` in ${formatYearMonth(`${lowestMonth.year}-${String(lowestMonth.month).padStart(2, '0')}`)}`}
            . Schuld ten opzichte van de kasstroom:{' '}
            {result.ratios.debtToCashflow.value === null
              ? '—'
              : `${formatNumber(result.ratios.debtToCashflow.value, 1)} jaar`}
            .
          </Text>
        </Section>

        <Section title="Scenario’s" intro="Alleen de omzet verschuift; de inkoopwaarde beweegt mee.">
          <Table
            rowHeader="Scenario"
            columns={['Omzetverschil', 'Omzet 3 jaar', 'DSCR jaar 1', 'Laagste saldo']}
            rows={result.scenarios.map((scenario) => ({
              label: SCENARIO_LABELS[scenario.key] ?? scenario.key,
              values: [
                scenario.revenueDeltaBp === 0 ? '—' : formatPercent(scenario.revenueDeltaBp, 0),
                formatCents(scenario.revenue),
                (() => {
                  const value = scenario.dscr.find((ratio) => ratio.period === 'y1')?.value;
                  return value == null ? '—' : formatNumber(value, 2);
                })(),
                formatCents(scenario.lowestCash.amount),
              ],
            }))}
          />
        </Section>
        <Footer disclaimer={DISCLAIMER} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Aannames" intro="Waar de cijfers op gebaseerd zijn.">
          <Table
            rowHeader="Aanname"
            columns={['Waarde']}
            rows={[
              { label: 'Eerste prognosemaand', values: [formatYearMonth(input.assumptions.startMonth)] },
              { label: 'Inkoopwaarde van de omzet', values: [formatPercent(input.assumptions.costOfSalesBp, 0)] },
              { label: 'Debiteurendagen', values: [`${formatNumber(input.assumptions.debtorDays)} dagen`] },
              { label: 'Crediteurendagen', values: [`${formatNumber(input.assumptions.creditorDays)} dagen`] },
              {
                label: 'Btw-aangifte',
                values: [input.assumptions.vat.filing === 'maand' ? 'per maand' : 'per kwartaal'],
              },
              { label: 'Omzetgroei jaar 2', values: [formatPercent(input.assumptions.revenueGrowthBp.y2, 0)] },
              { label: 'Omzetgroei jaar 3', values: [formatPercent(input.assumptions.revenueGrowthBp.y3, 0)] },
              {
                label: 'Privé-opname per maand',
                values: [formatCents(input.assumptions.privateWithdrawalsMonthlyCents)],
              },
              {
                label: 'Seizoenspatroon',
                values: [input.assumptions.seasonality.map((weight) => formatNumber(weight / 100, 2)).join(' · ')],
              },
            ]}
          />
        </Section>

        <Section title="Documenten" intro="Wat bij dit soort financiers gebruikelijk is.">
          <Table
            rowHeader="Document"
            columns={['Status']}
            rows={result.checklist.map((item) => ({
              label: `${item.label}${item.required ? '' : ' (optioneel)'}`,
              values: [item.status === 'heb_ik' ? 'heb ik' : 'nog regelen'],
            }))}
          />
        </Section>
        <Footer disclaimer={DISCLAIMER} />
      </Page>
    </Document>
  );
}
