import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToStream,
} from "@react-pdf/renderer";
import { Readable } from "stream";
import { REPORT_TYPE_LABEL } from "@/lib/utils/constants";
import type { ReportType } from "@/types";
import type { QbReportRow } from "@/lib/quickbooks/reports";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "2 solid #185FA5",
    paddingBottom: 10,
    marginBottom: 16,
  },
  brand: { color: "#185FA5", fontSize: 16, fontWeight: 700 },
  meta: { fontSize: 10, color: "#666" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 11, color: "#444", marginBottom: 16 },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #EDEBE5",
    paddingVertical: 4,
  },
  cellLabel: { flex: 4 },
  cellAmount: { flex: 1, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderTop: "1 solid #185FA5",
    marginTop: 4,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 9,
    color: "#888",
  },
});

interface ReportPdfProps {
  businessName: string;
  reportType: ReportType;
  start: string;
  end: string;
  rows: QbReportRow[];
  totals: { revenue: number; expenses: number; net: number };
}

function ReportPdf(props: ReportPdfProps) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Quad 4 Consulting Services</Text>
          <Text style={styles.meta}>
            Generated {new Date().toLocaleDateString("en-US")}
          </Text>
        </View>
        <Text style={styles.title}>{REPORT_TYPE_LABEL[props.reportType]}</Text>
        <Text style={styles.sub}>
          Prepared for: {props.businessName} · {props.start} to {props.end}
        </Text>

        {props.rows.map((r, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.cellLabel}>{r.label}</Text>
            <Text style={styles.cellAmount}>
              ${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.cellLabel}>Net total</Text>
          <Text style={styles.cellAmount}>
            ${props.totals.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <Text style={styles.footer}>
          Confidential — Prepared by Quad 4 Consulting Services
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(props: ReportPdfProps): Promise<Buffer> {
  const stream = await renderToStream(<ReportPdf {...props} />);
  return await streamToBuffer(stream);
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const r = Readable.from(stream as Readable);
  for await (const chunk of r) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
