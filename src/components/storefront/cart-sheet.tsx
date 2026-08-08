"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store";
import { formatDZD } from "@/lib/utils";

export function CartSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { items, removeItem } = useCartStore();
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🛒 Mon panier</DialogTitle>
          <DialogDescription>
            {items.length === 0
              ? "Votre panier est vide."
              : "Commandez chaque article via sa page produit (paiement à la livraison)."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.variantId} className="flex items-center justify-between gap-2 border-b pb-2">
              <div className="min-w-0">
                <Link
                  href={`/products/${item.productSlug}`}
                  className="block truncate font-medium hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  {item.productName}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {item.variantName} × {item.quantity} — {formatDZD(item.price * item.quantity)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeItem(item.variantId)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {items.length > 0 && (
            <p className="text-right font-semibold">Total : {formatDZD(total)}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
