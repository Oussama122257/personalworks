"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from "@react-pdf/renderer";
import type { OrderDTO } from "@/hooks/useOrders";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#ea680c" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 12 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e5e5", paddingVertical: 6 },
  headRow: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#000", paddingVertical: 6, fontFamily: "Helvetica-Bold" },
  cellRight: { flex: 1, textAlign: "right" },
  total: { marginTop: 16, textAlign: "right", fontSize: 13, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 9, color: "#888", textAlign: "center" },
});

function InvoiceDocument({ order }: { order: OrderDTO }) {
  const shippingFee = order.shipments.reduce((s, sh) => s + sh.shippingFee, 0);
  const sellers = [...new Set(order.shipments.map((s) => s.seller.name))].join(", ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Zeem.</Text>
          <View>
            <Text>Facture N° {order.reference}</Text>
            <Text>{new Date(order.createdAt).toLocaleDateString("fr-DZ")}</Text>
          </View>
        </View>

        <Text style={styles.title}>Facture — Paiement à la livraison</Text>

        <View style={{ marginBottom: 16 }}>
          <Text>Client : {order.buyer?.fullName ?? order.guestName ?? "—"}</Text>
          <Text>Téléphone : {order.guestPhone ?? "—"}</Text>
          <Text>
            Adresse : {order.address}
            {order.wilaya ? `, ${order.wilaya.name}` : ""}
          </Text>
          <Text>Vendeur(s) : {sellers || "—"}</Text>
        </View>

        <View style={styles.headRow}>
          <Text style={{ flex: 3 }}>Article</Text>
          <Text style={styles.cellRight}>Qté</Text>
          <Text style={styles.cellRight}>PU (DZD)</Text>
          <Text style={styles.cellRight}>Total (DZD)</Text>
        </View>
        {order.items.map((item) => (
          <View style={styles.row} key={item.id}>
            <Text style={{ flex: 3 }}>
              {item.variant.product.name} ({item.variant.sku})
            </Text>
            <Text style={styles.cellRight}>{item.quantity}</Text>
            <Text style={styles.cellRight}>{item.price.toFixed(2)}</Text>
            <Text style={styles.cellRight}>{(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        ))}
        <View style={styles.row}>
          <Text style={{ flex: 3 }}>Frais de livraison</Text>
          <Text style={styles.cellRight}>—</Text>
          <Text style={styles.cellRight}>—</Text>
          <Text style={styles.cellRight}>{shippingFee.toFixed(2)}</Text>
        </View>

        <Text style={styles.total}>
          TOTAL À PAYER : {order.totalAmount.toFixed(2)} DZD
        </Text>

        <Text style={styles.footer}>
          Zeem Marketplace — marché en ligne des 58 wilayas d&apos;Algérie. Document
          généré automatiquement.
        </Text>
      </Page>
    </Document>
  );
}

export function InvoiceDownloadButton({ order }: { order: OrderDTO }) {
  return (
    <PDFDownloadLink
      document={<InvoiceDocument order={order} />}
      fileName={`facture-${order.reference}.pdf`}
      className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent"
    >
      {({ loading }) => (loading ? "Génération…" : "📄 Facture PDF")}
    </PDFDownloadLink>
  );
}
