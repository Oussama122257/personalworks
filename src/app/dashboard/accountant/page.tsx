"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  FileDown,
  Scale,
  Wallet,
  Receipt,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import type { InvoiceData } from "@/components/dashboard/seller-invoice-pdf";
import { formatDZD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// @react-pdf/renderer is browser-only.
const SellerInvoiceDownload = dynamic(
  () =>
    import("@/components/dashboard/seller-invoice-pdf").then(
      (m) => m.SellerInvoiceDownload
    ),
  { ssr: false, loading: () => <span className="text-xs text-muted-foreground">PDF…</span> }
);

interface Reconciliation {
  deliveredShipments: number;
  codExpected: number;
  codCollected: number;
  codVariance: number;
  variancePct: number;
  totalCommissions: number;
  vatDue: number;
  vatRate: number;
  pendingPayoutsTotal: number;
  pendingPayoutsCount: number;
  flaggedShipments: {
    shipmentId: string;
    reference: string;
    store: string;
    expected: number;
    collected: number;
    variance: number;
    variancePct: number;
  }[];
}

interface PayoutBatch {
  totalAmount: number;
  missingRib: number;
  sellers: {
    sellerId: string;
    store: string;
    owner: string;
    rib: string | null;
    total: number;
    orders: number;
  }[];
}

interface SellerRow {
  id: string;
  name: string;
  owner: string;
  wilaya: string;
  rib: string | null;
  balance: number;
}

export default function AccountantDashboard() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [receipt, setReceipt] = useState("");
  const [settling, setSettling] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState<string | null>(null);

  const { data: recon } = useQuery<Reconciliation>({
    queryKey: ["reconciliation"],
    queryFn: async () => {
      const res = await fetch("/api/accountant/reconciliation");
      if (!res.ok) throw new Error("Failed to load reconciliation");
      return res.json();
    },
  });

  const rangeQs = [from ? `from=${from}` : "", to ? `to=${to}` : ""]
    .filter(Boolean)
    .join("&");

  const { data: batch } = useQuery<PayoutBatch>({
    queryKey: ["payout-batch", rangeQs],
    queryFn: async () => {
      const res = await fetch(`/api/accountant/bulk-payout${rangeQs ? `?${rangeQs}` : ""}`);
      if (!res.ok) throw new Error("Failed to load payouts");
      return res.json();
    },
  });

  const { data: sellers } = useQuery<SellerRow[]>({
    queryKey: ["accountant-sellers"],
    queryFn: async () => {
      const res = await fetch("/api/accountant/sellers");
      if (!res.ok) throw new Error("Failed to load sellers");
      const data = await res.json();
      return data.sellers;
    },
  });

  async function markPaid() {
    if (!batch || batch.sellers.length === 0) return;
    setSettling(true);
    try {
      const res = await fetch("/api/accountant/bulk-payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerIds: batch.sellers.map((s) => s.sellerId),
          reference: receipt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec");
        return;
      }
      toast.success(`${data.settled} virement(s) marqué(s) comme payés`);
      setReceipt("");
      queryClient.invalidateQueries();
    } finally {
      setSettling(false);
    }
  }

  async function loadInvoice(storeId: string) {
    setInvoiceBusy(storeId);
    try {
      const res = await fetch(
        `/api/accountant/invoice/${storeId}${rangeQs ? `?${rangeQs}` : ""}`
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec");
        return;
      }
      setInvoice(data);
      toast.success("Facture prête — cliquez sur Générer PDF");
    } finally {
      setInvoiceBusy(null);
    }
  }

  return (
    <div className="container space-y-6 py-6">
      <h1 className="text-2xl font-bold">Comptabilité</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Collecté (COD)"
          value={recon ? formatDZD(recon.codCollected) : "…"}
          hint={recon ? `${recon.deliveredShipments} livraisons` : undefined}
          icon={Banknote}
        />
        <StatCard
          title="Total Commissions"
          value={recon ? formatDZD(recon.totalCommissions) : "…"}
          icon={Receipt}
        />
        <StatCard
          title={`TVA à payer (${recon?.vatRate ?? 19}%)`}
          value={recon ? formatDZD(recon.vatDue) : "…"}
          hint="Sur les commissions perçues"
          icon={Scale}
        />
        <StatCard
          title="À payer aux vendeurs"
          value={recon ? formatDZD(recon.pendingPayoutsTotal) : "…"}
          hint={recon ? `${recon.pendingPayoutsCount} virements` : undefined}
          icon={Wallet}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Réconciliation COD</CardTitle>
          <CardDescription>Attendu vs réellement collecté par les livreurs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-6 text-lg">
            <span>
              Attendu :{" "}
              <strong>{recon ? formatDZD(recon.codExpected) : "…"}</strong>
            </span>
            <span className="text-muted-foreground">|</span>
            <span>
              Collecté :{" "}
              <strong>{recon ? formatDZD(recon.codCollected) : "…"}</strong>
            </span>
            <span className="text-muted-foreground">|</span>
            <span>
              Différence :{" "}
              <strong
                className={
                  recon && recon.codVariance !== 0 ? "text-destructive" : "text-green-600"
                }
              >
                {recon ? formatDZD(recon.codVariance) : "…"}
              </strong>
              {recon && recon.variancePct !== 0 && (
                <span className="ml-1 text-sm text-muted-foreground">
                  ({recon.variancePct}%)
                </span>
              )}
            </span>
          </div>

          {recon && recon.flaggedShipments.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {recon.flaggedShipments.length} livraison(s) avec un écart supérieur à 0,5 %
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Boutique</TableHead>
                    <TableHead className="text-right">Attendu</TableHead>
                    <TableHead className="text-right">Collecté</TableHead>
                    <TableHead className="text-right">Écart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recon.flaggedShipments.map((s) => (
                    <TableRow key={s.shipmentId}>
                      <TableCell className="font-mono text-xs">{s.reference}</TableCell>
                      <TableCell>{s.store}</TableCell>
                      <TableCell className="text-right">{formatDZD(s.expected)}</TableCell>
                      <TableCell className="text-right">{formatDZD(s.collected)}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatDZD(s.variance)} ({s.variancePct}%)
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="payouts">
        <TabsList>
          <TabsTrigger value="payouts">Virements groupés</TabsTrigger>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
        </TabsList>

        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle>Lot de virements bancaires</CardTitle>
              <CardDescription>
                Choisissez la période, exportez le CSV, puis marquez comme payé après
                réception du justificatif.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Du</Label>
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Au</Label>
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <Button asChild variant="outline">
                  <a
                    href={`/api/accountant/bulk-payout?format=csv${rangeQs ? `&${rangeQs}` : ""}`}
                    download
                  >
                    <FileDown /> Générer CSV Bancaire
                  </a>
                </Button>
              </div>

              {batch && batch.missingRib > 0 && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {batch.missingRib} vendeur(s) sans RIB — le virement échouera pour eux.
                </p>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendeur</TableHead>
                    <TableHead>RIB</TableHead>
                    <TableHead className="text-right">Commandes</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch?.sellers.map((s) => (
                    <TableRow key={s.sellerId}>
                      <TableCell>
                        {s.store}
                        <span className="block text-xs text-muted-foreground">{s.owner}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.rib ?? (
                          <Badge variant="destructive">Manquant</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{s.orders}</TableCell>
                      <TableCell className="text-right">{formatDZD(s.total)}</TableCell>
                    </TableRow>
                  ))}
                  {(!batch || batch.sellers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Aucun virement en attente sur cette période
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {batch && batch.sellers.length > 0 && (
                <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Référence du virement / justificatif</Label>
                    <Input
                      value={receipt}
                      onChange={(e) => setReceipt(e.target.value)}
                      placeholder="Ex : VIR-2026-04-12"
                      className="w-[260px]"
                    />
                  </div>
                  <Button disabled={settling} onClick={markPaid}>
                    {settling && <Loader2 className="animate-spin" />}
                    Marquer comme Payé ({formatDZD(batch.totalAmount)})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Factures vendeurs</CardTitle>
              <CardDescription>
                TVA {recon?.vatRate ?? 19}% appliquée sur la commission. La période
                sélectionnée ci-dessus s&apos;applique.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Boutique</TableHead>
                    <TableHead>Wilaya</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                    <TableHead className="text-right">Facture</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellers?.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        {s.name}
                        <span className="block text-xs text-muted-foreground">{s.owner}</span>
                      </TableCell>
                      <TableCell>{s.wilaya}</TableCell>
                      <TableCell className="text-right">{formatDZD(s.balance)}</TableCell>
                      <TableCell className="text-right">
                        {invoice?.store.name === s.name ? (
                          <SellerInvoiceDownload data={invoice} />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={invoiceBusy === s.id}
                            onClick={() => loadInvoice(s.id)}
                          >
                            {invoiceBusy === s.id && <Loader2 className="animate-spin" />}
                            Préparer
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!sellers || sellers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Aucun vendeur actif
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
