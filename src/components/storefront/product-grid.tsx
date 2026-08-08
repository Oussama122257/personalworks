"use client";

import { useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useAppStore } from "@/lib/store";
import { ProductCard } from "@/components/storefront/product-card";
import { StorefrontHeader } from "@/components/storefront/header";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const CATEGORIES = [
  "Tous",
  "Mode",
  "Électronique",
  "Maison",
  "Beauté",
  "Sport",
  "General",
];

export function Storefront() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Tous");
  const wilaya = useAppStore((s) => s.wilaya);

  const { data: products, isLoading, isError } = useProducts({
    q,
    wilayaCode: wilaya,
    category: category === "Tous" ? undefined : category,
  });

  return (
    <>
      <StorefrontHeader onSearch={setQ} />
      <main className="container py-6">
        <section className="mb-8 rounded-2xl bg-gradient-to-r from-primary to-orange-400 p-8 text-primary-foreground">
          <h1 className="text-3xl font-extrabold md:text-4xl">
            Le marché algérien, livré chez vous ⚡
          </h1>
          <p className="mt-2 max-w-xl opacity-90">
            Achetez auprès de vendeurs locaux dans les 58 wilayas. Paiement à la
            livraison, suivi en temps réel.
          </p>
        </section>

        <section className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}>
              <Badge
                variant={category === c ? "default" : "secondary"}
                className="cursor-pointer px-3 py-1 text-sm"
              >
                {c}
              </Badge>
            </button>
          ))}
        </section>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <p className="py-20 text-center text-muted-foreground">
            Impossible de charger les produits. Vérifiez que la base de données est
            démarrée et alimentée (npm run db:seed).
          </p>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="py-20 text-center text-muted-foreground">
            Aucun produit trouvé{q ? ` pour « ${q} »` : ""}.
          </p>
        )}
      </main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Zeem Marketplace — paiement à la livraison dans les 58 wilayas d&apos;Algérie.
      </footer>
    </>
  );
}
