"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Truck,
  Activity,
  Loader2,
  Save,
  Users,
  RefreshCw,
  Wifi,
  WifiOff,
  HelpCircle,
} from "lucide-react";
import { formatDZD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COURIERS = ["YALIDINE", "ZR_EXPRESS", "POSTE"] as const;

interface RateRow {
  id: string;
  wilayaCode: number;
  courierType: string;
  basePrice: number;
  pricePerKg: number;
  estimatedDays: string;
  isActive: boolean;
}

interface AgentRow {
  agentId: string;
  name: string;
  wilayaCode: number | null;
  deliveriesToday: number;
  collectedToday: number;
  totalDelivered: number;
  successRate: number | null;
  avgHours: number | null;
  activeTasks: number;
}

interface CourierHealthRow {
  courierType: string;
  isOnline: boolean | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  latencyMs: number | null;
  neverChecked: boolean;
}

export default function LogisticsDashboard() {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { basePrice: string; pricePerKg: string }>>({});
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const { data: matrix } = useQuery<{ rates: RateRow[]; wilayas: { code: number; name: string }[] }>({
    queryKey: ["shipping-matrix"],
    queryFn: async () => {
      const res = await fetch("/api/logistics/shipping-rates");
      if (!res.ok) throw new Error("Failed to load rates");
      return res.json();
    },
  });

  const { data: agentData } = useQuery<{ agents: AgentRow[]; unassigned: number }>({
    queryKey: ["logistics-agents"],
    queryFn: async () => {
      const res = await fetch("/api/logistics/agents");
      if (!res.ok) throw new Error("Failed to load agents");
      return res.json();
    },
  });

  const { data: health } = useQuery<{ couriers: CourierHealthRow[] }>({
    queryKey: ["courier-health"],
    queryFn: async () => {
      const res = await fetch("/api/logistics/courier-health");
      if (!res.ok) throw new Error("Failed to load health");
      return res.json();
    },
  });

  // Seed the editable grid once the matrix arrives.
  useEffect(() => {
    if (!matrix) return;
    const seeded: Record<string, { basePrice: string; pricePerKg: string }> = {};
    for (const r of matrix.rates) {
      seeded[`${r.wilayaCode}-${r.courierType}`] = {
        basePrice: String(r.basePrice),
        pricePerKg: String(r.pricePerKg),
      };
    }
    setEdits(seeded);
  }, [matrix]);

  async function saveMatrix() {
    if (!matrix) return;
    setSaving(true);
    try {
      const updates = matrix.rates
        .filter((r) => {
          const e = edits[`${r.wilayaCode}-${r.courierType}`];
          return (
            e && (Number(e.basePrice) !== r.basePrice || Number(e.pricePerKg) !== r.pricePerKg)
          );
        })
        .map((r) => {
          const e = edits[`${r.wilayaCode}-${r.courierType}`];
          return {
            wilayaCode: r.wilayaCode,
            courierType: r.courierType as (typeof COURIERS)[number],
            basePrice: Number(e.basePrice),
            pricePerKg: Number(e.pricePerKg),
          };
        });

      if (updates.length === 0) {
        toast.info("Aucune modification à enregistrer");
        return;
      }

      const res = await fetch("/api/logistics/shipping-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'enregistrement");
        return;
      }
      toast.success(`${data.updated} tarif(s) mis à jour`);
      queryClient.invalidateQueries({ queryKey: ["shipping-matrix"] });
    } finally {
      setSaving(false);
    }
  }

  /** Copies one wilaya's Yalidine pricing to its other couriers. */
  async function applyWholeWilaya(wilayaCode: number) {
    const e = edits[`${wilayaCode}-YALIDINE`];
    if (!e) return;
    const res = await fetch("/api/logistics/shipping-rates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [
          {
            wilayaCode,
            courierType: "YALIDINE",
            basePrice: Number(e.basePrice),
            pricePerKg: Number(e.pricePerKg),
          },
        ],
        applyToWholeWilaya: true,
      }),
    });
    if (res.ok) {
      toast.success(`Tarifs appliqués aux 3 transporteurs (wilaya ${wilayaCode})`);
      queryClient.invalidateQueries({ queryKey: ["shipping-matrix"] });
    } else {
      toast.error("Échec");
    }
  }

  async function runHealthCheck() {
    setChecking(true);
    try {
      const res = await fetch("/api/logistics/courier-health", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec du contrôle");
        return;
      }
      const online = data.results.filter((r: { online: boolean }) => r.online).length;
      toast.success(`Contrôle terminé — ${online}/${data.results.length} en ligne`);
      queryClient.invalidateQueries({ queryKey: ["courier-health"] });
    } finally {
      setChecking(false);
    }
  }

  async function autoAssign() {
    setAssigning(true);
    try {
      const res = await fetch("/api/logistics/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec");
        return;
      }
      toast.success(`${data.assigned} colis affecté(s)`);
      queryClient.invalidateQueries({ queryKey: ["logistics-agents"] });
    } finally {
      setAssigning(false);
    }
  }

  const ratesByWilaya = new Map<number, Record<string, RateRow>>();
  for (const r of matrix?.rates ?? []) {
    const entry = ratesByWilaya.get(r.wilayaCode) ?? {};
    entry[r.courierType] = r;
    ratesByWilaya.set(r.wilayaCode, entry);
  }

  return (
    <div className="container space-y-6 py-6">
      <h1 className="text-2xl font-bold">Logistique</h1>

      {/* Courier status board */}
      <div className="grid gap-4 sm:grid-cols-3">
        {health?.couriers.map((c) => (
          <Card key={c.courierType}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Truck className="h-4 w-4" /> {c.courierType.replace("_", " ")}
                </span>
                {c.neverChecked ? (
                  <Badge variant="secondary">
                    <HelpCircle className="mr-1 h-3 w-3" /> Jamais testé
                  </Badge>
                ) : c.isOnline ? (
                  <Badge variant="success">
                    <Wifi className="mr-1 h-3 w-3" /> Online
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <WifiOff className="mr-1 h-3 w-3" /> Offline
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {c.lastCheckedAt ? (
                <p>Vérifié : {new Date(c.lastCheckedAt).toLocaleString("fr-DZ")}</p>
              ) : (
                <p>Aucun contrôle effectué</p>
              )}
              {c.latencyMs !== null && <p>Latence : {c.latencyMs} ms</p>}
              {c.lastError && <p className="text-destructive">{c.lastError}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={checking} onClick={runHealthCheck}>
          {checking ? <Loader2 className="animate-spin" /> : <Activity />}
          Contrôler les API transporteurs
        </Button>
        <Button variant="outline" disabled={assigning} onClick={autoAssign}>
          {assigning ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Affecter les colis en attente
          {agentData ? ` (${agentData.unassigned})` : ""}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Le contrôle de santé est déclenché manuellement ici. Pour un suivi
        automatique toutes les 5 minutes, planifiez un appel à{" "}
        <code>POST /api/logistics/courier-health</code> avec l&apos;en-tête{" "}
        <code>x-cron-secret</code> (Vercel Cron, GitHub Actions ou tout
        ordonnanceur externe) — Next.js n&apos;embarque pas de planificateur.
      </p>

      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix">Matrice tarifaire</TabsTrigger>
          <TabsTrigger value="agents">Performance livreurs</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Matrice 58 wilayas × 3 transporteurs</CardTitle>
                <CardDescription>
                  Prix de base (jusqu&apos;à 1 kg) et prix par kg supplémentaire.
                </CardDescription>
              </div>
              <Button disabled={saving} onClick={saveMatrix}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                Enregistrer
              </Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[180px]">Wilaya</TableHead>
                      {COURIERS.map((c) => (
                        <TableHead key={c} className="text-center">
                          {c.replace("_", " ")}
                          <span className="block text-[10px] font-normal">
                            base / par kg
                          </span>
                        </TableHead>
                      ))}
                      <TableHead className="w-[70px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrix?.wilayas.map((w) => (
                      <TableRow key={w.code}>
                        <TableCell className="text-sm">
                          <span className="font-mono text-xs text-muted-foreground">
                            {w.code}
                          </span>{" "}
                          {w.name}
                        </TableCell>
                        {COURIERS.map((c) => {
                          const key = `${w.code}-${c}`;
                          const rate = ratesByWilaya.get(w.code)?.[c];
                          if (!rate) {
                            return (
                              <TableCell key={c} className="text-center text-xs text-muted-foreground">
                                —
                              </TableCell>
                            );
                          }
                          return (
                            <TableCell key={c}>
                              <div className="flex gap-1">
                                <Input
                                  className="h-8 w-20 text-xs"
                                  type="number"
                                  value={edits[key]?.basePrice ?? ""}
                                  onChange={(e) =>
                                    setEdits((prev) => ({
                                      ...prev,
                                      [key]: {
                                        ...prev[key],
                                        basePrice: e.target.value,
                                      },
                                    }))
                                  }
                                />
                                <Input
                                  className="h-8 w-16 text-xs"
                                  type="number"
                                  value={edits[key]?.pricePerKg ?? ""}
                                  onChange={(e) =>
                                    setEdits((prev) => ({
                                      ...prev,
                                      [key]: {
                                        ...prev[key],
                                        pricePerKg: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Appliquer le tarif Yalidine aux 3 transporteurs"
                            onClick={() => applyWholeWilaya(w.code)}
                          >
                            ⇥ tous
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Performance des livreurs
              </CardTitle>
              <CardDescription>
                L&apos;affectation automatique privilégie le livreur le moins chargé,
                puis le plus proche.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Name</TableHead>
                    <TableHead>Wilaya</TableHead>
                    <TableHead className="text-right">Deliveries Today</TableHead>
                    <TableHead className="text-right">Encaissé</TableHead>
                    <TableHead className="text-right">Tâches en cours</TableHead>
                    <TableHead className="text-right">Success Rate</TableHead>
                    <TableHead className="text-right">Avg Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentData?.agents.map((a) => (
                    <TableRow key={a.agentId}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.wilayaCode ?? "—"}</TableCell>
                      <TableCell className="text-right">{a.deliveriesToday}</TableCell>
                      <TableCell className="text-right">
                        {formatDZD(a.collectedToday)}
                      </TableCell>
                      <TableCell className="text-right">{a.activeTasks}</TableCell>
                      <TableCell className="text-right">
                        {a.successRate === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge
                            variant={
                              a.successRate >= 90
                                ? "success"
                                : a.successRate >= 70
                                  ? "warning"
                                  : "destructive"
                            }
                          >
                            {a.successRate}%
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {a.avgHours === null ? "—" : `${a.avgHours} h`}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!agentData || agentData.agents.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Aucun livreur enregistré
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
