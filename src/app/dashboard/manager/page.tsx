"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  X,
  Store,
  ShoppingBag,
  Percent,
  DollarSign,
  Flame,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatDZD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ManagerStats {
  wilayaCode: number;
  regionalGmv: number;
  regionalOrders: number;
  activeStores: number;
  pendingStores: number;
  commissionPaid: number;
  commissionPending: number;
  commissionTotal: number;
  heatmap: { communeId: number; name: string; orders: number; revenue: number }[];
}

interface PendingStoreDTO {
  id: string;
  name: string;
  createdAt: string;
  logoUrl?: string | null;
  address?: string | null;
  user: { fullName: string; email?: string | null; phone: string };
  wilaya: { name: string };
}

function RejectDialog({
  store,
  onClose,
  onDone,
}: {
  store: PendingStoreDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/manager/stores/${store.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec du rejet");
        return;
      }
      toast.success("Boutique rejetée — le vendeur a été notifié");
      onClose();
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rejeter « {store.name} »</DialogTitle>
          <DialogDescription>
            Le motif est obligatoire et sera envoyé au vendeur par email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Motif du rejet</Label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex : registre de commerce illisible, merci de renvoyer un scan net."
            />
          </div>
          <Button
            className="w-full"
            variant="destructive"
            disabled={reason.trim().length < 3 || busy}
            onClick={submit}
          >
            Confirmer le rejet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ManagerDashboard() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<PendingStoreDTO | null>(null);

  const { data: stats } = useQuery<ManagerStats>({
    queryKey: ["manager-stats"],
    queryFn: async () => {
      const res = await fetch("/api/manager/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const { data: pending } = useQuery<PendingStoreDTO[]>({
    queryKey: ["pending-stores"],
    queryFn: async () => {
      const res = await fetch("/api/manager/stores?status=PENDING");
      if (!res.ok) throw new Error("Failed to load stores");
      const data = await res.json();
      return data.stores;
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["pending-stores"] });
    queryClient.invalidateQueries({ queryKey: ["manager-stats"] });
  }

  async function approve(storeId: string) {
    const res = await fetch(`/api/manager/stores/${storeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Échec");
      return;
    }
    toast.success("Boutique approuvée ✅ — le vendeur a été notifié");
    refresh();
  }

  async function requestPayout() {
    const res = await fetch("/api/manager/payout-request", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Échec de la demande");
      return;
    }
    toast.success(
      `Demande de paiement envoyée : ${formatDZD(data.requestedAmount)}`
    );
    refresh();
  }

  const maxCommuneOrders = stats?.heatmap.reduce((m, c) => Math.max(m, c.orders), 0) ?? 0;

  return (
    <div className="container space-y-6 py-6">
      <h1 className="text-2xl font-bold">
        Manager de wilaya {stats ? `— Wilaya ${stats.wilayaCode}` : ""}
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ventes (Wilaya)"
          value={stats?.regionalOrders ?? "…"}
          icon={ShoppingBag}
        />
        <StatCard
          title="Revenu Total"
          value={stats ? formatDZD(stats.regionalGmv) : "…"}
          icon={DollarSign}
        />
        <StatCard
          title="Vendeurs Actifs"
          value={stats?.activeStores ?? "…"}
          hint={stats ? `${stats.pendingStores} en attente` : undefined}
          icon={Store}
        />
        <StatCard
          title="Ma Commission (2%)"
          value={stats ? formatDZD(stats.commissionTotal) : "…"}
          hint={
            stats
              ? `${formatDZD(stats.commissionPending)} en attente de règlement`
              : undefined
          }
          icon={Percent}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendeurs en attente d&apos;approbation</CardTitle>
          <CardDescription>
            Les nouvelles boutiques de votre wilaya doivent être validées avant de vendre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store Name</TableHead>
                <TableHead>Propriétaire</TableHead>
                <TableHead>Date d&apos;inscription</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead className="text-right">Décision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    {s.user.fullName}
                    <span className="block text-xs text-muted-foreground">
                      {s.user.email ?? s.user.phone}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(s.createdAt).toLocaleDateString("fr-DZ")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.logoUrl ? (
                      <a
                        href={s.logoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Voir le logo
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Aucun document</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      className="mr-2 bg-green-600 hover:bg-green-700"
                      onClick={() => approve(s.id)}
                    >
                      <Check /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejecting(s)}>
                      <X /> Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!pending || pending.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucune demande en attente 🎉
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" /> Activité par commune
            </CardTitle>
            <CardDescription>Volume de commandes dans votre wilaya</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.heatmap.map((c) => (
                <div key={c.communeId} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm">{c.name}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded bg-orange-500"
                      style={{
                        width: `${maxCommuneOrders > 0 ? (c.orders / maxCommuneOrders) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right text-sm text-muted-foreground">
                    {c.orders} ordre{c.orders === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
              {(!stats || stats.heatmap.length === 0) && (
                <p className="text-sm text-muted-foreground">Aucune donnée</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Commission disponible
            </CardTitle>
            <CardDescription>Part manager (2%) sur les livraisons</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-extrabold text-primary">
              {stats ? formatDZD(stats.commissionPaid) : "…"}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats ? `${formatDZD(stats.commissionPending)} encore en attente de règlement` : ""}
            </p>
            <Button
              className="w-full"
              disabled={!stats || stats.commissionPaid <= 0}
              onClick={requestPayout}
            >
              Demander Paiement
            </Button>
          </CardContent>
        </Card>
      </div>

      {rejecting && (
        <RejectDialog
          store={rejecting}
          onClose={() => setRejecting(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}
