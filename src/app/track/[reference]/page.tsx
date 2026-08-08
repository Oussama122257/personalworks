import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  MapPin,
  Package,
  Truck,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDZD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STEPS: { key: string; label: string }[] = [
  { key: "PENDING_PICKUP", label: "En attente de ramassage" },
  { key: "PICKED_UP", label: "Ramassé" },
  { key: "IN_TRANSIT", label: "En transit" },
  { key: "OUT_FOR_DELIVERY", label: "En cours de livraison" },
  { key: "DELIVERED_COD_COLLECTED", label: "Livré — paiement encaissé" },
];

export default async function TrackPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  const order = await prisma.order.findUnique({
    where: { reference: reference.toUpperCase() },
    include: {
      shipments: {
        include: {
          locationUpdates: { orderBy: { createdAt: "desc" }, take: 10 },
          seller: { select: { name: true } },
        },
      },
      items: {
        include: {
          variant: { select: { sku: true, product: { select: { name: true } } } },
        },
      },
      wilaya: { select: { name: true } },
    },
  });

  if (!order) notFound();

  const shipment = order.shipments[0];
  const failed = shipment?.status === "FAILED" || shipment?.status === "RETURNED";
  const currentIdx = shipment
    ? STEPS.findIndex((s) => s.key === shipment.status)
    : -1;
  const shippingFee = order.shipments.reduce((s, sh) => s + sh.shippingFee, 0);
  const itemsLabel = order.items
    .map((i) => `${i.variant.product.name} × ${i.quantity}`)
    .join(", ");

  return (
    <main className="container max-w-2xl py-10">
      <Link href="/" className="text-sm text-primary hover:underline">
        ← Retour à la boutique
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
        <Truck className="h-6 w-6 text-primary" /> Suivi de commande {order.reference}
      </h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {itemsLabel || "Commande"}
            </span>
            <Badge variant={failed ? "destructive" : "secondary"}>
              {failed ? "Échec de livraison" : STEPS[Math.max(currentIdx, 0)]?.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {shipment && <p>Vendeur : {shipment.seller.name}</p>}
          <p>
            Destination : {order.address}
            {order.wilaya ? `, ${order.wilaya.name}` : ""}
          </p>
          <p>
            Total à payer à la livraison :{" "}
            <span className="font-semibold text-foreground">
              {formatDZD(order.totalAmount)}
            </span>{" "}
            (dont livraison {formatDZD(shippingFee)})
          </p>
          {shipment?.trackingNumber && <p>N° de suivi : {shipment.trackingNumber}</p>}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Progression</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {STEPS.map((step, i) => {
              const done = !failed && currentIdx >= i;
              return (
                <li key={step.key} className="flex items-center gap-3">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className={done ? "font-medium" : "text-muted-foreground"}>
                    {step.label}
                  </span>
                </li>
              );
            })}
            {failed && (
              <li className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="font-medium text-destructive">
                  {shipment?.failureReason ?? "Livraison échouée"}
                </span>
              </li>
            )}
          </ol>
        </CardContent>
      </Card>

      {shipment && shipment.locationUpdates.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Dernières positions du livreur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {shipment.locationUpdates.map((u) => (
              <p key={u.id}>
                {u.createdAt.toLocaleString("fr-DZ")} — ({u.lat.toFixed(5)},{" "}
                {u.lng.toFixed(5)})
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
