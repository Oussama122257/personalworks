"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin,
  Package,
  Phone,
  Loader2,
  Banknote,
  Navigation,
  Satellite,
  Store,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useRealtime } from "@/hooks/useRealtime";
import { formatDZD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ShipmentDTO {
  id: string;
  trackingNumber?: string | null;
  status: string;
  codAmount: number;
  attemptCount: number;
  seller: { name: string };
  order: {
    reference: string;
    guestName?: string | null;
    guestPhone?: string | null;
    address: string;
    wilaya?: { name: string } | null;
    items: { id: string; quantity: number; variant: { product: { name: string } } }[];
  };
}

interface AgentSummary {
  zone: string;
  collectedToday: number;
  deliveredToday: number;
  pickupsPending: number;
  inTransit: number;
}

const FAILURE_REASONS = [
  "BUYER_NOT_HOME",
  "WRONG_ADDRESS",
  "BUYER_UNREACHABLE",
  "ORDER_REFUSED",
  "PACKAGE_DAMAGED",
  "OTHER",
] as const;

const FAILURE_LABEL: Record<string, string> = {
  BUYER_NOT_HOME: "Client absent",
  WRONG_ADDRESS: "Adresse incorrecte",
  BUYER_UNREACHABLE: "Client injoignable",
  ORDER_REFUSED: "Commande refusée",
  PACKAGE_DAMAGED: "Colis endommagé",
  OTHER: "Autre",
};

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "secondary" | "success" | "destructive" | "warning" }
> = {
  PENDING_PICKUP: { label: "À ramasser", variant: "warning" },
  PICKED_UP: { label: "Ramassé", variant: "secondary" },
  IN_TRANSIT: { label: "En transit", variant: "secondary" },
  OUT_FOR_DELIVERY: { label: "En livraison", variant: "secondary" },
  DELIVERED_COD_COLLECTED: { label: "Livré ✅", variant: "success" },
  FAILED: { label: "Échec", variant: "destructive" },
  RETURNED: { label: "Retourné", variant: "destructive" },
};

/** Sends the browser position for the active shipment every 60s while enabled. */
function useGpsPing(shipmentIds: string[], enabled: boolean) {
  const [status, setStatus] = useState<"idle" | "active" | "denied">("idle");
  const idsRef = useRef(shipmentIds);
  idsRef.current = shipmentIds;

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      setStatus("idle");
      return;
    }

    async function ping() {
      const target = idsRef.current[0];
      if (!target) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setStatus("active");
          await fetch("/api/agent/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shipmentId: target,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy),
            }),
          }).catch(() => undefined);
        },
        () => setStatus("denied"),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    ping();
    const timer = setInterval(ping, 60_000);
    return () => clearInterval(timer);
  }, [enabled]);

  return status;
}

function CollectDialog({
  shipment,
  onClose,
  onDone,
}: {
  shipment: ShipmentDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(String(shipment.codAmount));
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const coords = await new Promise<{ lat?: number; lng?: number }>((resolve) => {
        if (!navigator.geolocation) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({}),
          { timeout: 3000 }
        );
      });
      const res = await fetch("/api/agent/deliver", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: shipment.id,
          collectedAmount: Number(amount),
          ...coords,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec de la confirmation");
        return;
      }
      toast.success(`Livraison confirmée — ${formatDZD(Number(amount))} encaissés ✅`);
      onClose();
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const mismatch = Number(amount) !== shipment.codAmount;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>💰 Confirmer l&apos;encaissement</DialogTitle>
          <DialogDescription>
            Commande {shipment.order.reference} — à collecter :{" "}
            <strong>{formatDZD(shipment.codAmount)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Montant encaissé (DZD)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {mismatch && (
              <p className="text-xs text-amber-600">
                Différent du montant attendu — l&apos;écart sera signalé à la
                comptabilité.
              </p>
            )}
          </div>
          <Button className="w-full" size="lg" disabled={busy} onClick={confirm}>
            {busy ? <Loader2 className="animate-spin" /> : <Banknote />}
            Collecté ✅
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FailDialog({
  shipment,
  onClose,
  onDone,
}: {
  shipment: ShipmentDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const attemptsLeft = 3 - shipment.attemptCount - 1;

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch("/api/agent/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId: shipment.id, reason, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec");
        return;
      }
      toast.success(
        data.returned
          ? "3e échec — le colis part en retour vendeur"
          : `Échec enregistré — nouvelle tentative prévue (${data.attemptCount}/3)`
      );
      onClose();
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>🚫 Échec de livraison</DialogTitle>
          <DialogDescription>
            Commande {shipment.order.reference} — tentative {shipment.attemptCount + 1}/3.
            {attemptsLeft <= 0
              ? " Cette tentative déclenchera le retour vendeur."
              : ` ${attemptsLeft} tentative(s) restante(s).`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Motif</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un motif" />
              </SelectTrigger>
              <SelectContent>
                {FAILURE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {FAILURE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Note (optionnelle)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            className="w-full"
            variant="destructive"
            disabled={!reason || busy}
            onClick={confirm}
          >
            {busy && <Loader2 className="animate-spin" />} Confirmer l&apos;échec
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AgentDashboard() {
  const queryClient = useQueryClient();
  const user = useAppStore((s) => s.user);
  const [collecting, setCollecting] = useState<ShipmentDTO | null>(null);
  const [failing, setFailing] = useState<ShipmentDTO | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(true);

  const { data: summary } = useQuery<AgentSummary>({
    queryKey: ["agent-summary"],
    queryFn: async () => {
      const res = await fetch("/api/agent/summary");
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
  });

  const { data: shipments, isLoading } = useQuery<ShipmentDTO[]>({
    queryKey: ["agent-shipments"],
    queryFn: async () => {
      const res = await fetch("/api/shipments");
      if (!res.ok) throw new Error("Failed to load shipments");
      const data = await res.json();
      return data.shipments;
    },
  });

  const active =
    shipments?.filter(
      (s) => !["DELIVERED_COD_COLLECTED", "RETURNED"].includes(s.status)
    ) ?? [];
  const pickups = active.filter((s) => s.status === "PENDING_PICKUP");
  const deliveries = active.filter((s) => s.status !== "PENDING_PICKUP");
  const done =
    shipments?.filter((s) =>
      ["DELIVERED_COD_COLLECTED", "RETURNED"].includes(s.status)
    ) ?? [];

  const gpsStatus = useGpsPing(
    deliveries.map((s) => s.id),
    gpsEnabled && deliveries.length > 0
  );

  useRealtime(user ? `agent-${user.id}` : null, "shipment:update", () => {
    queryClient.invalidateQueries({ queryKey: ["agent-shipments"] });
    queryClient.invalidateQueries({ queryKey: ["agent-summary"] });
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["agent-shipments"] });
    queryClient.invalidateQueries({ queryKey: ["agent-summary"] });
  }

  return (
    // Mobile-first PWA layout: phone width, centered.
    <div className="mx-auto max-w-[430px] space-y-4 p-4">
      {/* GPS indicator */}
      <div className="flex items-center justify-between rounded-lg border bg-background p-2 text-xs">
        <span className="flex items-center gap-1.5">
          <Satellite
            className={`h-3.5 w-3.5 ${
              gpsStatus === "active"
                ? "text-green-600"
                : gpsStatus === "denied"
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          />
          {gpsStatus === "active"
            ? "GPS Actif"
            : gpsStatus === "denied"
              ? "GPS refusé par le navigateur"
              : gpsEnabled
                ? "GPS en attente"
                : "GPS désactivé"}
        </span>
        <Button
          size="sm"
          variant={gpsEnabled ? "outline" : "secondary"}
          className="h-7 text-xs"
          onClick={() => setGpsEnabled((v) => !v)}
        >
          {gpsEnabled ? "Désactiver" : "Activer"}
        </Button>
      </div>

      {/* Today summary */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="py-4">
          <p className="flex items-center gap-1 text-sm opacity-90">
            <MapPin className="h-4 w-4" /> {summary?.zone ?? "…"}
          </p>
          <p className="mt-1 text-2xl font-extrabold">
            💰 {summary ? formatDZD(summary.collectedToday) : "…"}
          </p>
          <p className="text-xs opacity-90">
            Total collecté aujourd&apos;hui · {summary?.deliveredToday ?? 0} livraison(s)
          </p>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Pickups */}
      {pickups.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground">
            📥 Ramassages ({pickups.length})
          </h2>
          {pickups.map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-2 py-3">
                <p className="flex items-center gap-2 font-medium">
                  <Store className="h-4 w-4" /> {s.seller.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.order.reference} · {s.order.items.length} colis
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <a href={`tel:${s.order.guestPhone ?? ""}`}>
                      <Phone /> Appeler
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <a
                      href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(s.order.address)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation /> Itinéraire
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {/* Deliveries */}
      <h2 className="text-sm font-semibold text-muted-foreground">
        📦 Livraisons ({deliveries.length})
      </h2>
      {deliveries.map((s) => {
        const st = STATUS_LABEL[s.status] ?? { label: s.status, variant: "secondary" as const };
        return (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4" /> {s.order.reference}
                </span>
                <Badge variant={st.variant}>{st.label}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">
                {s.order.items.map((i) => `${i.variant.product.name} × ${i.quantity}`).join(", ")}
              </p>
              <p className="flex items-start gap-1 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {s.order.address}
                {s.order.wilaya ? `, ${s.order.wilaya.name}` : ""}
              </p>
              {s.order.guestPhone && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <a href={`tel:${s.order.guestPhone}`} className="underline">
                    {s.order.guestPhone}
                  </a>
                  {s.order.guestName ? ` — ${s.order.guestName}` : ""}
                </p>
              )}
              {s.attemptCount > 0 && (
                <p className="text-xs text-amber-600">
                  Tentative{s.attemptCount > 1 ? "s" : ""} précédente(s) : {s.attemptCount}/3
                </p>
              )}
              <p className="text-lg font-bold text-primary">
                {formatDZD(s.codAmount)} <span className="text-xs font-normal">(COD)</span>
              </p>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" size="lg" onClick={() => setCollecting(s)}>
                  💰 Collecté ✅
                </Button>
                <Button variant="destructive" size="lg" onClick={() => setFailing(s)}>
                  🚫
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {deliveries.length === 0 && !isLoading && (
        <p className="py-6 text-center text-muted-foreground">
          Aucune livraison en cours 🎉
        </p>
      )}

      {done.length > 0 && (
        <>
          <h2 className="pt-2 text-sm font-semibold text-muted-foreground">Terminées</h2>
          {done.map((s) => {
            const st = STATUS_LABEL[s.status] ?? {
              label: s.status,
              variant: "secondary" as const,
            };
            return (
              <Card key={s.id} className="opacity-70">
                <CardContent className="flex items-center justify-between py-3">
                  <span className="font-mono text-xs">{s.order.reference}</span>
                  <span className="text-sm">{formatDZD(s.codAmount)}</span>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {collecting && (
        <CollectDialog
          shipment={collecting}
          onClose={() => setCollecting(null)}
          onDone={refresh}
        />
      )}
      {failing && (
        <FailDialog shipment={failing} onClose={() => setFailing(null)} onDone={refresh} />
      )}
    </div>
  );
}
