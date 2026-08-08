"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWilayas } from "@/hooks/useWilayas";
import { formatDZD } from "@/lib/utils";

export function FastOrderDialog({
  open,
  onOpenChange,
  variantId,
  productName,
  unitPrice,
  quantity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}) {
  const router = useRouter();
  const { data: wilayas } = useWilayas();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    guestName: "",
    phone: "",
    wilayaCode: "",
    communeId: "",
    address: "",
  });

  const communes = useMemo(
    () => wilayas?.find((w) => w.code === Number(form.wilayaCode))?.communes ?? [],
    [wilayas, form.wilayaCode]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/fast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId,
          quantity,
          guestName: form.guestName,
          phone: form.phone,
          wilayaCode: Number(form.wilayaCode),
          communeId: Number(form.communeId),
          address: form.address,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec de la commande");
        return;
      }
      toast.success(`Commande confirmée ! Référence : ${data.reference}`);
      onOpenChange(false);
      router.push(`/track/${data.reference}`);
    } catch {
      toast.error("Erreur réseau, veuillez réessayer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Commande rapide
          </DialogTitle>
          <DialogDescription>
            {productName} × {quantity} — {formatDZD(unitPrice * quantity)} + livraison.
            Paiement à la livraison.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="guestName">Nom complet</Label>
            <Input
              id="guestName"
              required
              minLength={2}
              value={form.guestName}
              onChange={(e) => setForm({ ...form, guestName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              type="tel"
              required
              minLength={8}
              placeholder="05xx xx xx xx"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Wilaya</Label>
            <Select
              value={form.wilayaCode}
              onValueChange={(v) => setForm({ ...form, wilayaCode: v, communeId: "" })}
              required
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
          <div className="space-y-1.5">
            <Label>Commune</Label>
            <Select
              value={form.communeId}
              onValueChange={(v) => setForm({ ...form, communeId: v })}
              disabled={!form.wilayaCode}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une commune" />
              </SelectTrigger>
              <SelectContent>
                {communes.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              required
              minLength={5}
              placeholder="Rue, quartier, repères…"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !form.wilayaCode || !form.communeId}
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Zap />}
            Confirmer la commande
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
