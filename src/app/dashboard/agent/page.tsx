"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Package, Phone, Loader2, Banknote } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useRealtime } from "@/hooks/useRealtime";
import { formatDZD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface ShipmentDTO {
  id: string;
  trackingNumber?: string | null;
  status: string;
  codAmount: number;
  order: {
    reference: string;
    guestName?: string | null;
    guestPhone?: string | null;
    address: string;
    wilaya?: { name: string } | null;
    items: {
      id: string;
      quantity: number;
      variant: { sku: string; product: { name: string } };
    }[];
  };
}

const FAILURE_REASONS = [
  "BUYER_NOT_HOME",
  "WRONG_ADDRESS",
  "BUYER_UNREACHABLE",
  "ORDER_REFUSED",
  "PACKAGE_DAMAGED",
  "OTHER",
];

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
      // Attach GPS position when the device allows it.
      const coords = await new Promise<{ lat?: number; lng?: number }>((resolve) => {
        if (!navigator.geolocation) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({}),
          { timeout: 3000 }
        );
      });
      const res = await fetch(`/api/shipments/${shipment.id}/deliver`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectedAmount: Number(amount), ...coords }),
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

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>💰 Confirmer l&apos;encaissement</DialogTitle>
          <DialogDescription>
            Commande {shipment.order.reference} — montant à collecter :{" "}
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
          </div>
          <Button className="w-full" disabled={busy} onClick={confirm}>
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
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch(`/api/shipments/${shipment.id}/fail`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec");
        return;
      }
      toast.success("Échec de livraison enregistré");
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
          <DialogDescription>Commande {shipment.order.reference}</DialogDescription>
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

  const { data: shipments, isLoading } = useQuery<ShipmentDTO[]>({
    queryKey: ["agent-shipments"],
    queryFn: async () => {
      const res = await fetch("/api/shipments");
      if (!res.ok) throw new Error("Failed to load shipments");
      const data = await res.json();
      return data.shipments;
    },
  });

  // Live: task status updates for this agent.
  useRealtime(user ? `agent-${user.id}` : null, "shipment:update", () => {
    queryClient.invalidateQueries({ queryKey: ["agent-shipments"] });
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["agent-shipments"] });
  }

  const active = shipments?.filter(
    (s) => !["DELIVERED_COD_COLLECTED", "FAILED", "RETURNED"].includes(s.status)
  );
  const done = shipments?.filter((s) =>
    ["DELIVERED_COD_COLLECTED", "FAILED", "RETURNED"].includes(s.status)
  );

  return (
    // Mobile-first PWA layout: phone width, centered.
    <div className="mx-auto max-w-[430px] space-y-4 p-4">
      <h1 className="text-xl font-bold">📦 Mes tournées du jour</h1>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {active?.map((s) => {
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
                {s.order.items
                  .map((i) => `${i.variant.product.name} × ${i.quantity}`)
                  .join(", ")}
              </p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
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
              <p className="text-sm">
                À encaisser :{" "}
                <span className="font-bold text-primary">{formatDZD(s.codAmount)}</span>
              </p>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={() => setCollecting(s)}>
                  💰 Collecté ✅
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setFailing(s)}
                >
                  🚫 Échec
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {active && active.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">
          Aucune livraison en cours 🎉
        </p>
      )}

      {done && done.length > 0 && (
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
