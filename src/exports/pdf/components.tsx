import { Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { styles } from './styles';

export interface PdfRow {
  label: string;
  values: readonly string[];
  emphasis?: boolean;
  indent?: boolean;
}

export function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {intro !== undefined && <Text style={styles.sectionIntro}>{intro}</Text>}
      {children}
    </View>
  );
}

export function Table({ columns, rows, rowHeader = '' }: { columns: readonly string[]; rows: readonly PdfRow[]; rowHeader?: string }) {
  return (
    <View style={styles.table}>
      <View style={styles.headerRow}>
        <Text style={styles.headerCellLabel}>{rowHeader}</Text>
        {columns.map((column) => (
          <Text key={column} style={styles.headerCell}>
            {column}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.label} style={row.emphasis === true ? styles.totalRow : styles.row}>
          <Text style={[row.indent === true ? styles.cellLabelIndent : styles.cellLabel, ...(row.emphasis === true ? [styles.bold] : [])]}>
            {row.label}
          </Text>
          {row.values.map((value, index) => (
            <Text
              key={`${row.label}-${columns[index] ?? index}`}
              style={[styles.cell, ...(row.emphasis === true ? [styles.bold] : [])]}
            >
              {value}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function KeyNumbers({
  items,
}: {
  items: readonly { label: string; value: string; note?: string | undefined }[];
}) {
  return (
    <View style={styles.keyValueGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.keyValue}>
          <Text style={styles.keyLabel}>{item.label}</Text>
          <Text style={styles.keyNumber}>{item.value}</Text>
          {item.note !== undefined && <Text style={styles.keyNote}>{item.note}</Text>}
        </View>
      ))}
    </View>
  );
}

export function Footer({ disclaimer }: { disclaimer: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{disclaimer}</Text>
      <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}
