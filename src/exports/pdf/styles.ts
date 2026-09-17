import { StyleSheet } from '@react-pdf/renderer';

/** Sober en zakelijk: een financier leest dit naast tien andere dossiers. */
export const colors = {
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  accent: '#1d4ed8',
  negative: '#b91c1c',
  zebra: '#f8fafc',
};

export const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 48,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: colors.ink,
  },
  coverPage: {
    padding: 64,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: colors.ink,
    justifyContent: 'space-between',
  },
  coverLabel: { fontSize: 10, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase' },
  coverTitle: { fontSize: 30, fontFamily: 'Helvetica-Bold', marginTop: 12 },
  coverCompany: { fontSize: 16, marginTop: 24 },
  coverMeta: { fontSize: 10, color: colors.muted, marginTop: 4 },

  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  sectionIntro: { fontSize: 9, color: colors.muted, marginBottom: 10 },
  section: { marginBottom: 22 },

  paragraph: { fontSize: 10, lineHeight: 1.5, marginBottom: 8 },
  subheading: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 4 },

  table: { width: '100%' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.line, paddingVertical: 3 },
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 3 },
  totalRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.ink, paddingVertical: 3 },
  cellLabel: { flex: 3, paddingRight: 6 },
  cellLabelIndent: { flex: 3, paddingRight: 6, paddingLeft: 10, color: colors.muted },
  cell: { flex: 1.3, textAlign: 'right' },
  headerCell: { flex: 1.3, textAlign: 'right', fontSize: 8, color: colors.muted, textTransform: 'uppercase' },
  headerCellLabel: { flex: 3, fontSize: 8, color: colors.muted, textTransform: 'uppercase' },
  bold: { fontFamily: 'Helvetica-Bold' },
  negative: { color: colors.negative },

  keyValueGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  keyValue: { width: '25%', paddingRight: 10, marginBottom: 10 },
  keyLabel: { fontSize: 8, color: colors.muted, textTransform: 'uppercase' },
  keyNumber: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  keyNote: { fontSize: 8, color: colors.muted },

  footer: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: colors.line,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: colors.muted, flex: 1, paddingRight: 12 },
  pageNumber: { fontSize: 7, color: colors.muted },

  tocItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
});
