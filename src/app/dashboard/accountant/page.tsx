"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Banknote, FileDown, Scale, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { useOrders } from "@/hooks/useOrders";
import { formatDZD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// @react-pdf/renderer is browser-only: load it client-side without SSR.
const InvoiceDownloadButton = dynamic(
  () =>
    import("@/components/dashboard/invoice-pdf").then((m) => m.InvoiceDownloadButton),
  { ssr: false, loading: () => <span className="text-xs text-muted-foreground">PDF…</span> }
);

interface Reconciliation {
  deliveredShipments: number;
  codExpected: number;
  codCollected: number;
  codVariance: number;
  pendingPayoutsTotal: number;
  pendingPayoutsCount: number;
  commissions: Record<string, number>;
}

interface PayoutDTO {
  id: string;
  amount: number;
  store: string;
  owner: string;
  orderReference: string;
  createdAt: string;
}

export default function AccountantDashboard() {
  const { data: recon } = useQuery<Reconciliation>({
    queryKey: ["reconciliation"],
    queryFn: async () => {
      const res = await fetch("/api/accountant/reconciliation");
      if (!res.ok) throw new Error("Failed to load reconciliation");
      return res.json();
    },
  });

  const { data: payouts } = useQuery<PayoutDTO[]>({
    queryKey: ["payouts"],
    queryFn: async () => {
      const res = await fetch("/api/accountant/payouts");
      if (!res.ok) throw new Error("Failed to load payouts");
      const data = await res.json();
      return data.payouts;
    },
  });

  const { data: orders } = useOrders({ status: "DELIVERED" });

  return (
    <div className="container space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Comptabilité</h1>
        <Button asChild variant="outline">
          <a href="/api/accountant/payouts?format=csv" download>
            <FileDown /> Exporter les virements (CSV)
          </a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="COD encaissé"
          value={recon ? formatDZD(recon.codCollected) : "…"}
          hint={recon ? `${recon.deliveredShipments} livraisons` : undefined}
          icon={Banknote}
        />
        <StatCard
          title="Écart de caisse"
          value={recon ? formatDZD(recon.codVariance) : "…"}
          hint={recon ? `Attendu : ${formatDZD(recon.codExpected)}` : undefined}
          icon={Scale}
        />
        <StatCard
          title="Virements en attente"
          value={recon ? formatDZD(recon.pendingPayoutsTotal) : "…"}
          hint={recon ? `${recon.pendingPayoutsCount} paiements` : undefined}
          icon={Wallet}
        />
        <StatCard
          title="Commissions plateforme"
          value={
            recon
              ? formatDZD(
                  (recon.commissions.COMMISSION_OWNER ?? 0) +
                    (recon.commissions.COMMISSION_MANAGER ?? 0)
                )
              : "…"
          }
          hint={
            recon
              ? `Owner ${formatDZD(recon.commissions.COMMISSION_OWNER ?? 0)} · Managers ${formatDZD(recon.commissions.COMMISSION_MANAGER ?? 0)}`
              : undefined
          }
          icon={Banknote}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Virements vendeurs en attente</CardTitle>
            <CardDescription>
              Utilisez l&apos;export CSV pour préparer le lot bancaire.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Boutique</TableHead>
                  <TableHead>Commande</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.store}
                      <span className="block text-xs text-muted-foreground">{p.owner}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.orderReference}</TableCell>
                    <TableCell className="text-right">{formatDZD(p.amount)}</TableCell>
                  </TableRow>
                ))}
                {(!payouts || payouts.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Aucun virement en attente
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Factures — commandes livrées</CardTitle>
            <CardDescription>Génération PDF par commande.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Réf.</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Facture</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.slice(0, 15).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                    <TableCell>{o.guestName ?? "—"}</TableCell>
                    <TableCell>{formatDZD(o.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      <InvoiceDownloadButton order={o} />
                    </TableCell>
                  </TableRow>
                ))}
                {(!orders || orders.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Aucune commande livrée
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {orders && orders.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="mr-1">
                  {orders.length}
                </Badge>
                commandes livrées au total
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
