"use client";

import Link from "next/link";
import { ShoppingCart, Zap, LogIn, LayoutDashboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore, useCartStore } from "@/lib/store";
import { useWilayas } from "@/hooks/useWilayas";
import { CartSheet } from "@/components/storefront/cart-sheet";
import { useState } from "react";

export function StorefrontHeader({
  onSearch,
}: {
  onSearch?: (q: string) => void;
}) {
  const { user, wilaya, setWilaya } = useAppStore();
  const items = useCartStore((s) => s.items);
  const { data: wilayas } = useWilayas();
  const [cartOpen, setCartOpen] = useState(false);

  const dashboardHome: Record<string, string> = {
    admin: "/dashboard/admin",
    seller: "/dashboard/seller",
    wilaya_manager: "/dashboard/manager",
    accountant: "/dashboard/accountant",
    agent: "/dashboard/agent",
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center gap-3">
        <Link href="/" className="flex items-center gap-1 text-xl font-extrabold">
          <Zap className="h-6 w-6 text-primary" />
          <span>
            Zeem<span className="text-primary">.</span>
          </span>
        </Link>

        <div className="hidden flex-1 items-center gap-2 md:flex">
          <Input
            placeholder="Rechercher un produit…"
            className="max-w-md"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch?.((e.target as HTMLInputElement).value);
            }}
          />
          <Select
            value={wilaya ? String(wilaya) : "all"}
            onValueChange={(v) => setWilaya(v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Toutes les wilayas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les wilayas</SelectItem>
              {wilayas?.map((w) => (
                <SelectItem key={w.code} value={String(w.code)}>
                  {w.code} — {w.nameFr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user && dashboardHome[user.role] ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={dashboardHome[user.role]}>
                <LayoutDashboard /> Tableau de bord
              </Link>
            </Button>
          ) : !user ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">
                <LogIn /> Connexion
              </Link>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon"
            className="relative"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart />
            {items.length > 0 && (
              <Badge className="absolute -right-2 -top-2 h-5 w-5 justify-center rounded-full p-0">
                {items.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </header>
  );
}
