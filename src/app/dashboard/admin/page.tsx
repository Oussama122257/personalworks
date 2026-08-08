"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DollarSign,
  ShoppingBag,
  Store,
  XCircle,
  Wand2,
  Trophy,
  Package,
  MapPin,
  ScrollText,
  UserPlus,
  PackageSearch,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart, type SeriesPoint } from "@/components/dashboard/revenue-chart";
import { GeoMap, type WilayaDensity } from "@/components/dashboard/geo-map";
import { useRealtime } from "@/hooks/useRealtime";
import { useWilayas } from "@/hooks/useWilayas";
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
  gmvThisMonth: number;
  totalSales: number;
  deliveredOrders: number;
  activeSellers: number;
  codRefusalRate: number;
  trends: { gmvLastMonth: number; growthPct: number };
  series: SeriesPoint[];
}

interface Leaderboard {
  topStores: {
    storeId: string;
    name: string;
    wilaya: string;
    revenue: number;
    units: number;
    orders: number;
  }[];
  topProducts: {
    variantId: string;
    sku: string;
    name: string;
    store: string;
    quantitySold: number;
  }[];
}

interface AuditLogDTO {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  createdAt: string;
}

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

const RANK_STYLE = [
  "bg-amber-400 text-amber-950", // #1 gold
  "bg-slate-300 text-slate-900", // #2 silver
  "bg-amber-700 text-amber-50", // #3 bronze
];

function GodModeDialog({
  entity,
  open,
  onOpenChange,
  onDone,
}: {
  entity: "order" | "product";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [id, setId] = useState("");
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [published, setPublished] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const data =
        entity === "order"
          ? { ...(status ? { status } : {}) }
          : {
              ...(name ? { name } : {}),
              ...(price ? { price: Number(price) } : {}),
              ...(stock ? { stockQuantity: Number(stock) } : {}),
              ...(published ? { isPublished: published === "true" } : {}),
            };
      if (Object.keys(data).length === 0) {
        toast.error("Renseignez au moins un champ à modifier");
        return;
      }
      const res = await fetch("/api/admin/force-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id, data, reason }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error ?? "Échec de la mise à jour");
        return;
      }
      toast.success("Modification forcée appliquée et auditée");
      onOpenChange(false);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-destructive" />
            God Mode — {entity === "order" ? "forcer une commande" : "forcer un produit"}
          </DialogTitle>
          <DialogDescription>
            Contourne les contrôles de propriété vendeur. Le motif est obligatoire
            et l&apos;état avant/après est enregistré dans le journal d&apos;audit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{entity === "order" ? "ID de la commande" : "ID du produit"}</Label>
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="cm…" />
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
            <>
              <div className="space-y-1.5">
                <Label>Nom (optionnel)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prix — toutes variantes</Label>
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Stock — toutes variantes</Label>
                  <Input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Publication</Label>
                <Select value={published} onValueChange={setPublished}>
                  <SelectTrigger>
                    <SelectValue placeholder="Inchangée" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Publié</SelectItem>
                    <SelectItem value="false">Dépublié</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Motif (obligatoire)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex : correction suite à réclamation client #123"
            />
          </div>
          <Button
            className="w-full"
            variant="destructive"
            disabled={!id || reason.trim().length < 3 || busy}
            onClick={submit}
          >
            Appliquer la modification forcée
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateStaffDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: wilayas } = useWilayas();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "AGENT",
    wilayaCode: "",
  });
  const needsWilaya = form.role === "AGENT" || form.role === "WILAYA_MANAGER";

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          wilayaCode: form.wilayaCode ? Number(form.wilayaCode) : undefined,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error ?? "Échec de la création");
        return;
      }
      toast.success("Compte créé");
      setOpen(false);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlus /> Nouveau membre
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un compte personnel</DialogTitle>
            <DialogDescription>
              Managers de wilaya, livreurs, comptables, ERP, logistique et support.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WILAYA_MANAGER">Manager de wilaya</SelectItem>
                  <SelectItem value="AGENT">Livreur</SelectItem>
                  <SelectItem value="ACCOUNTANT">Comptable</SelectItem>
                  <SelectItem value="ERP_MANAGER">Manager ERP</SelectItem>
                  <SelectItem value="LOGISTICS_MANAGER">Manager logistique</SelectItem>
                  <SelectItem value="SUPPORT">Support client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nom complet</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mot de passe (8+ caractères)</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            {needsWilaya && (
              <div className="space-y-1.5">
                <Label>Wilaya</Label>
                <Select
                  value={form.wilayaCode}
                  onValueChange={(v) => setForm({ ...form, wilayaCode: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une wilaya" />
                  </SelectTrigger>
                  <SelectContent>
                    {wilayas?.map((w) => (
                      <SelectItem key={w.code} value={String(w.code)}>
                        {w.code} — {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              className="w-full"
              disabled={
                busy ||
                !form.fullName ||
                !form.email ||
                !form.phone ||
                form.password.length < 8 ||
                (needsWilaya && !form.wilayaCode)
              }
              onClick={submit}
            >
              Créer le compte
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [godMode, setGodMode] = useState<"order" | "product" | null>(null);

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const { data: board } = useQuery<Leaderboard>({
    queryKey: ["admin-leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/admin/leaderboard");
      if (!res.ok) throw new Error("Failed to load leaderboard");
      return res.json();
    },
  });

  const { data: geo } = useQuery<{ density: WilayaDensity[]; maxOrders: number }>({
    queryKey: ["admin-geo"],
    queryFn: async () => {
      const res = await fetch("/api/admin/geo");
      if (!res.ok) throw new Error("Failed to load geo data");
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

  // Live: every new order refreshes the KPI row, chart and map.
  useRealtime("orders", "order:new", () => {
    toast.info("Nouvelle commande reçue 🎉");
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-geo"] });
    queryClient.invalidateQueries({ queryKey: ["admin-leaderboard"] });
  });

  function refreshAll() {
    queryClient.invalidateQueries();
  }

  return (
    <div className="container space-y-6 py-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vue d&apos;ensemble de la plateforme</h1>
        <CreateStaffDialog onDone={refreshAll} />
      </div>

      {/* Pulse stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="GMV (Mois)"
          value={stats ? formatDZD(stats.gmvThisMonth) : "…"}
          hint={
            stats
              ? `${stats.trends.growthPct >= 0 ? "+" : ""}${stats.trends.growthPct}% vs mois dernier`
              : undefined
          }
          icon={DollarSign}
        />
        <StatCard
          title="Total Ventes"
          value={stats?.totalSales ?? "…"}
          hint={stats ? `${stats.deliveredOrders} livrées` : undefined}
          icon={ShoppingBag}
        />
        <StatCard title="Vendeurs Actifs" value={stats?.activeSellers ?? "…"} icon={Store} />
        <StatCard
          title="Taux Refus COD"
          value={stats ? `${stats.codRefusalRate}%` : "…"}
          hint="Échecs / livraisons terminées"
          icon={XCircle}
        />
      </div>

      {/* Performance chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenu vs Commandes — 30 derniers jours</CardTitle>
          <CardDescription>
            Le revenu ne compte que les commandes livrées (encaissées).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <RevenueChart data={stats.series} />
          ) : (
            <div className="h-[280px] animate-pulse rounded-md bg-muted" />
          )}
        </CardContent>
      </Card>

      {/* Leaderboards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> Top 10 boutiques
            </CardTitle>
            <CardDescription>Par chiffre d&apos;affaires livré</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Boutique</TableHead>
                  <TableHead>Wilaya</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {board?.topStores.map((s, i) => (
                  <TableRow key={s.storeId}>
                    <TableCell>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          RANK_STYLE[i] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.wilaya}</TableCell>
                    <TableCell className="text-right">{formatDZD(s.revenue)}</TableCell>
                  </TableRow>
                ))}
                {(!board || board.topStores.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Aucune vente livrée
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Top 10 produits
            </CardTitle>
            <CardDescription>Par quantité vendue</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {board?.topProducts.map((p, i) => (
                  <TableRow key={p.variantId}>
                    <TableCell>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          RANK_STYLE[i] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.name}
                      <span className="block text-xs text-muted-foreground">{p.store}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {p.quantitySold}
                    </TableCell>
                  </TableRow>
                ))}
                {(!board || board.topProducts.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Aucune vente livrée
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Geo + audit feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Densité des commandes par wilaya
            </CardTitle>
            <CardDescription>Les 58 wilayas, colorées par volume</CardDescription>
          </CardHeader>
          <CardContent>
            {geo ? (
              <GeoMap density={geo.density} maxOrders={geo.maxOrders} />
            ) : (
              <div className="h-40 animate-pulse rounded-md bg-muted" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-4 w-4" /> Activité récente
            </CardTitle>
            <CardDescription>10 dernières actions</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
              {logs?.slice(0, 10).map((l) => (
                <li key={l.id} className="border-l-2 border-primary/40 pl-3 text-sm">
                  <p>
                    <span className="font-medium">{l.actor}</span>{" "}
                    <span className="text-muted-foreground">
                      {l.action.toLowerCase().replace(/_/g, " ")} {l.entityType.toLowerCase()}
                    </span>
                  </p>
                  {l.reason && (
                    <p className="text-xs italic text-muted-foreground">« {l.reason} »</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString("fr-DZ")}
                  </p>
                </li>
              ))}
              {(!logs || logs.length === 0) && (
                <li className="text-sm text-muted-foreground">Aucune activité</li>
              )}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* God Mode floating actions */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-2">
        <Button
          size="sm"
          variant="destructive"
          className="shadow-lg"
          onClick={() => setGodMode("product")}
        >
          <PackageSearch /> Forcer produit
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="shadow-lg"
          onClick={() => setGodMode("order")}
        >
          <Wand2 /> Forcer commande
        </Button>
      </div>

      {godMode && (
        <GodModeDialog
          key={godMode}
          entity={godMode}
          open
          onOpenChange={(o) => !o && setGodMode(null)}
          onDone={refreshAll}
        />
      )}
    </div>
  );
}
