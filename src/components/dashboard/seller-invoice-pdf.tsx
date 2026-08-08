"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from "@react-pdf/renderer";

export interface InvoiceData {
  store: {
    name: string;
    owner: string;
    contact: string;
    wilaya: string;
    rib?: string | null;
    commissionRate: number;
  };
  period: { from: string | null; to: string | null };
  lines: {
    reference: string;
    deliveredAt: string | null;
    collected: number;
    shippingFee: number;
  }[];
  totals: {
    deliveries: number;
    grossCollected: number;
    shippingTotal: number;
    commissionHT: number;
    vatRate: number;
    vat: number;
    commissionTTC: number;
    netToSeller: number;
  };
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  brand: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#ea680c" },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  block: { marginBottom: 14 },
  headRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    paddingVertical: 5,
    fontFamily: "Helvetica-Bold",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 4,
  },
  right: { flex: 1, textAlign: "right" },
  totals: { marginTop: 14, alignSelf: "flex-end", width: 260 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderTopWidth: 2,
    borderTopColor: "#000",
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#888",
    textAlign: "center",
  },
});

function fmt(n: number) {
  return n.toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function InvoiceDocument({ data }: { data: InvoiceData }) {
  const period =
    data.period.from || data.period.to
      ? `${data.period.from ?? "début"} → ${data.period.to ?? "aujourd'hui"}`
      : "Toutes périodes";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Zeem.</Text>
            <Text style={{ fontSize: 8, color: "#666" }}>Zeem Marketplace — Algérie</Text>
          </View>
          <View>
            <Text>Facture de commission</Text>
            <Text style={{ fontSize: 8, color: "#666" }}>
              Émise le {new Date().toLocaleDateString("fr-DZ")}
            </Text>
            <Text style={{ fontSize: 8, color: "#666" }}>Période : {period}</Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.h1}>Vendeur</Text>
          <Text>{data.store.name}</Text>
          <Text>{data.store.owner}</Text>
          <Text>{data.store.contact}</Text>
          <Text>Wilaya : {data.store.wilaya}</Text>
          {data.store.rib && <Text>RIB : {data.store.rib}</Text>}
        </View>

        <Text style={styles.h1}>Livraisons encaissées ({data.totals.deliveries})</Text>
        <View style={styles.headRow}>
          <Text style={{ flex: 2 }}>Référence</Text>
          <Text style={{ flex: 1.5 }}>Livrée le</Text>
          <Text style={styles.right}>Livraison</Text>
          <Text style={styles.right}>Encaissé</Text>
        </View>
        {data.lines.slice(0, 40).map((l) => (
          <View style={styles.row} key={l.reference}>
            <Text style={{ flex: 2 }}>{l.reference}</Text>
            <Text style={{ flex: 1.5 }}>
              {l.deliveredAt ? new Date(l.deliveredAt).toLocaleDateString("fr-DZ") : "—"}
            </Text>
            <Text style={styles.right}>{fmt(l.shippingFee)}</Text>
            <Text style={styles.right}>{fmt(l.collected)}</Text>
          </View>
        ))}
        {data.lines.length > 40 && (
          <Text style={{ marginTop: 4, fontSize: 8, color: "#666" }}>
            … et {data.lines.length - 40} autres livraisons
          </Text>
        )}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Total encaissé</Text>
            <Text>{fmt(data.totals.grossCollected)} DZD</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Commission HT ({data.store.commissionRate}%)</Text>
            <Text>{fmt(data.totals.commissionHT)} DZD</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>TVA ({data.totals.vatRate}%)</Text>
            <Text>{fmt(data.totals.vat)} DZD</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Commission TTC</Text>
            <Text>{fmt(data.totals.commissionTTC)} DZD</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Frais de livraison</Text>
            <Text>{fmt(data.totals.shippingTotal)} DZD</Text>
          </View>
          <View style={styles.grand}>
            <Text>Net à verser</Text>
            <Text>{fmt(data.totals.netToSeller)} DZD</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Document généré automatiquement par Zeem Marketplace. TVA algérienne au taux
          en vigueur de {data.totals.vatRate}%.
        </Text>
      </Page>
    </Document>
  );
}

export function SellerInvoiceDownload({ data }: { data: InvoiceData }) {
  return (
    <PDFDownloadLink
      document={<InvoiceDocument data={data} />}
      fileName={`facture-${data.store.name.replace(/\s+/g, "-").toLowerCase()}.pdf`}
      className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent"
    >
      {({ loading }) => (loading ? "Génération…" : "📄 Générer PDF")}
    </PDFDownloadLink>
  );
}
