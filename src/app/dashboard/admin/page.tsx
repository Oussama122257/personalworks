"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DollarSign,
  ShoppingBag,
  Store,
  RotateCcw,
  Wand2,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { useOrders } from "@/hooks/useOrders";
import { useRealtime } from "@/hooks/useRealtime";
import { formatDZD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdminStats {
  gmv: number;
  totalOrders: number;
  activeSellers: number;
  refundRate: number;
  topStores: { storeId: string; name: string; wilaya: string; revenue: number; orders: number }[];
  trends: { gmvThisMonth: number; gmvLastMonth: number; growthPct: number };
}

interface AuditLogDTO {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
];

function GodModeDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [entity, setEntity] = useState<"order" | "product">("order");
  const [id, setId] = useState("");
  const [status, setStatus] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const data =
        entity === "order"
          ? { ...(status ? { status } : {}) }
          : { ...(price ? { basePrice: Number(price) } : {}) };
      const res = await fetch("/api/admin/force-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id, data }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error ?? "Échec de la mise à jour");
        return;
      }
      toast.success("Mise à jour forcée effectuée (auditée)");
      setOpen(false);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Wand2 /> God Mode
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚡ God Mode — édition forcée</DialogTitle>
            <DialogDescription>
              Modifie directement une commande ou un produit. Chaque action est
              consignée dans le journal d&apos;audit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Entité</Label>
              <Select value={entity} onValueChange={(v) => setEntity(v as "order" | "product")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">Commande</SelectItem>
                  <SelectItem value="product">Produit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ID</Label>
              <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="cl…" />
            </div>
            {entity === "order" ? (
              <div className="space-y-1.5">
                <Label>Nouveau statut</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Nouveau prix de base (DZD)</Label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            )}
            <Button className="w-full" disabled={!id || busy} onClick={submit}>
              Appliquer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const { data: logs } = useQuery<AuditLogDTO[]>({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/audit-logs");
      if (!res.ok) throw new Error("Failed to load audit logs");
      const data = await res.json();
      return data.logs;
    },
  });

  const { data: orders } = useOrders();

  // Live: new orders appear instantly on the "orders" channel.
  useRealtime("orders", "order:new", () => {
    toast.info("Nouvelle commande reçue 🎉");
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  });

  function refreshAll() {
    queryClient.invalidateQueries();
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vue d&apos;ensemble de la plateforme</h1>
        <GodModeDialog onDone={refreshAll} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="GMV total"
          value={stats ? formatDZD(stats.gmv) : "…"}
          hint={
            stats
              ? `${stats.trends.growthPct >= 0 ? "+" : ""}${stats.trends.growthPct}% vs mois dernier`
              : undefined
          }
          icon={DollarSign}
        />
        <StatCard
          title="Commandes"
          value={stats?.totalOrders ?? "…"}
          icon={ShoppingBag}
        />
        <StatCard
          title="Vendeurs actifs"
          value={stats?.activeSellers ?? "…"}
          icon={Store}
        />
        <StatCard
          title="Taux de remboursement"
          value={stats ? `${stats.refundRate}%` : "…"}
          icon={RotateCcw}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Classement des boutiques
            </CardTitle>
            <CardDescription>Top 5 par chiffre d&apos;affaires</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Boutique</TableHead>
                  <TableHead>Wilaya</TableHead>
                  <TableHead>Commandes</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.topStores.map((s, i) => (
                  <TableRow key={s.storeId}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.wilaya}</TableCell>
                    <TableCell>{s.orders}</TableCell>
                    <TableCell className="text-right">{formatDZD(s.revenue)}</TableCell>
                  </TableRow>
                ))}
                {(!stats || stats.topStores.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Aucune donnée
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commandes récentes (live)</CardTitle>
            <CardDescription>Mises à jour en temps réel</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Réf.</TableHead>
                  <TableHead>Boutique</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.slice(0, 8).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                    <TableCell>{o.store.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{o.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatDZD(o.totalAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Journal d&apos;audit</CardTitle>
          <CardDescription>50 dernières actions sensibles</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Acteur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString("fr-DZ")}
                  </TableCell>
                  <TableCell>
                    {l.actor} <span className="text-xs text-muted-foreground">({l.actorRole})</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.action}</TableCell>
                  <TableCell className="text-xs">
                    {l.entityType} · {l.entityId.slice(0, 10)}…
                  </TableCell>
                </TableRow>
              ))}
              {(!logs || logs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucune entrée
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
