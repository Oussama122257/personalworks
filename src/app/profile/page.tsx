"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Gift, Package, Sparkles, User } from "lucide-react";
import { StorefrontHeader } from "@/components/storefront/header";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatDZD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

interface ProfileResponse {
  profile: {
    fullName: string;
    email?: string | null;
    phone: string;
    role: string;
    createdAt: string;
  } | null;
  orders: {
    id: string;
    reference: string;
    totalAmount: number;
    status: string;
    address: string;
    createdAt: string;
    wilaya?: { name: string } | null;
    items: { id: string; quantity: number; variant: { product: { name: string } } }[];
    shipments: { status: string; trackingNumber?: string | null }[];
  }[];
  loyalty: { balance: number; lifetimeEarned: number; lifetimeRedeemed: number };
  pointsLedger: {
    id: string;
    amount: number;
    type: string;
    description?: string | null;
    createdAt: string;
  }[];
}

export default function ProfilePage() {
  const { data, isLoading, isError } = useQuery<ProfileResponse>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("unauthenticated");
      return res.json();
    },
    retry: false,
  });

  if (isError) {
    return (
      <>
        <StorefrontHeader />
        <main className="container py-20 text-center">
          <User className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-3 text-xl font-bold">Connectez-vous pour voir votre profil</h1>
          <Link href="/login" className="mt-2 inline-block text-primary underline">
            Aller à la connexion
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <StorefrontHeader />
      <main className="container space-y-6 py-6">
        <h1 className="text-2xl font-bold">
          {isLoading ? "Mon profil" : `Bonjour, ${data?.profile?.fullName ?? ""}`}
        </h1>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Points de fidélité"
            value={data?.loyalty.balance ?? "…"}
            hint="1 point par 100 DZD dépensés"
            icon={Sparkles}
          />
          <StatCard
            title="Points cumulés"
            value={data?.loyalty.lifetimeEarned ?? "…"}
            icon={Gift}
          />
          <StatCard title="Commandes" value={data?.orders.length ?? "…"} icon={Package} />
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Mes commandes</TabsTrigger>
            <TabsTrigger value="points">Historique des points</TabsTrigger>
            <TabsTrigger value="account">Mon compte</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réf.</TableHead>
                      <TableHead>Articles</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Link
                            href={`/track/${o.reference}`}
                            className="font-mono text-xs text-primary underline"
                          >
                            {o.reference}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">
                          {o.items
                            .map((i) => `${i.variant.product.name} × ${i.quantity}`)
                            .join(", ")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(o.createdAt).toLocaleDateString("fr-DZ")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={o.status === "DELIVERED" ? "success" : "secondary"}>
                            {o.shipments[0]?.status ?? o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDZD(o.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data && data.orders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Aucune commande pour le moment
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="points">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historique des points</CardTitle>
                <CardDescription>
                  Utilisables au paiement : 1 point = 1 DZD de réduction.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Détail</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.pointsLedger.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">
                          {new Date(p.createdAt).toLocaleDateString("fr-DZ")}
                        </TableCell>
                        <TableCell className="text-xs">{p.type}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.description ?? "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            p.amount >= 0 ? "text-green-600" : "text-destructive"
                          }`}
                        >
                          {p.amount >= 0 ? `+${p.amount}` : p.amount}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data && data.pointsLedger.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Aucun mouvement de points
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <Card>
              <CardContent className="space-y-2 pt-6 text-sm">
                <p>
                  <span className="text-muted-foreground">Nom :</span>{" "}
                  {data?.profile?.fullName}
                </p>
                <p>
                  <span className="text-muted-foreground">Email :</span>{" "}
                  {data?.profile?.email ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Téléphone :</span>{" "}
                  {data?.profile?.phone}
                </p>
                <p>
                  <span className="text-muted-foreground">Membre depuis :</span>{" "}
                  {data?.profile
                    ? new Date(data.profile.createdAt).toLocaleDateString("fr-DZ")
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
