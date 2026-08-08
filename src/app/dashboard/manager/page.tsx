"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Store, ShoppingBag, Percent, DollarSign } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatDZD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  commissionEarned: number;
}

interface PendingStoreDTO {
  id: string;
  name: string;
  createdAt: string;
  owner: { fullName: string; email?: string | null; phone?: string | null };
  wilaya: { nameFr: string };
}

export default function ManagerDashboard() {
  const queryClient = useQueryClient();

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

  async function decide(storeId: string, action: "approve" | "reject") {
    const res = await fetch(`/api/manager/stores/${storeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Échec");
      return;
    }
    toast.success(action === "approve" ? "Boutique approuvée ✅" : "Boutique rejetée");
    queryClient.invalidateQueries({ queryKey: ["pending-stores"] });
    queryClient.invalidateQueries({ queryKey: ["manager-stats"] });
  }

  return (
    <div className="container space-y-6 py-6">
      <h1 className="text-2xl font-bold">
        Manager de wilaya {stats ? `— Wilaya ${stats.wilayaCode}` : ""}
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="GMV régional"
          value={stats ? formatDZD(stats.regionalGmv) : "…"}
          icon={DollarSign}
        />
        <StatCard title="Commandes" value={stats?.regionalOrders ?? "…"} icon={ShoppingBag} />
        <StatCard
          title="Boutiques actives"
          value={stats?.activeStores ?? "…"}
          hint={stats ? `${stats.pendingStores} en attente` : undefined}
          icon={Store}
        />
        <StatCard
          title="Mes commissions (20%)"
          value={stats ? formatDZD(stats.commissionEarned) : "…"}
          hint="Part manager sur les commissions"
          icon={Percent}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approbations de vendeurs en attente</CardTitle>
          <CardDescription>
            Les nouvelles boutiques de votre wilaya doivent être validées avant de vendre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Boutique</TableHead>
                <TableHead>Propriétaire</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Demandée le</TableHead>
                <TableHead className="text-right">Décision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.owner.fullName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.owner.email ?? s.owner.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(s.createdAt).toLocaleDateString("fr-DZ")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      className="mr-2 bg-green-600 hover:bg-green-700"
                      onClick={() => decide(s.id, "approve")}
                    >
                      <Check /> Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide(s.id, "reject")}
                    >
                      <X /> Rejeter
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
    </div>
  );
}
