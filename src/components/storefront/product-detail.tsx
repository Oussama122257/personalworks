"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Zap, ShoppingCart, Package, Star, Minus, Plus } from "lucide-react";
import { StorefrontHeader } from "@/components/storefront/header";
import { FastOrderDialog } from "@/components/storefront/fast-order-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/lib/store";
import { formatDZD } from "@/lib/utils";
import { variantLabel, type ProductDTO } from "@/hooks/useProducts";

type ReviewDTO = {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  buyer?: { fullName: string } | null;
};

export type ProductWithReviews = ProductDTO & { reviews: ReviewDTO[] };

export function ProductDetail({ product }: { product: ProductWithReviews }) {
  const [imageIdx, setImageIdx] = useState(0);
  const [variantId, setVariantId] = useState(
    product.variants.find((v) => v.stockQuantity > 0)?.id ?? product.variants[0]?.id
  );
  const [quantity, setQuantity] = useState(1);
  const [orderOpen, setOrderOpen] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const variant = useMemo(
    () => product.variants.find((v) => v.id === variantId),
    [product.variants, variantId]
  );

  const sizes = [...new Set(product.variants.map((v) => v.attributes?.size).filter(Boolean))] as string[];
  const colors = [...new Set(product.variants.map((v) => v.attributes?.color).filter(Boolean))] as string[];
  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length
      : null;

  const mainImage = variant?.image ?? product.images[imageIdx];

  return (
    <>
      <StorefrontHeader />
      <main className="container py-6">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-muted">
              {mainImage ? (
                <Image
                  src={mainImage}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <Package className="h-20 w-20 text-muted-foreground" />
              )}
            </div>
            {product.images.length > 1 && (
              <div className="mt-2 flex gap-2">
                {product.images.map((img, i) => (
                  <button
                    key={img}
                    onClick={() => setImageIdx(i)}
                    className={`relative h-16 w-16 overflow-hidden rounded-md border-2 ${
                      i === imageIdx ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <Image src={img} alt="" fill sizes="64px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <p className="text-sm text-muted-foreground">
              {product.store.name}
              {product.category ? ` · ${product.category}` : ""}
            </p>
            <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>
            {avgRating !== null && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {avgRating.toFixed(1)} ({product.reviews.length} avis)
              </p>
            )}
            <p className="mt-3 text-3xl font-extrabold text-primary">
              {variant ? formatDZD(variant.price) : "—"}
              {variant?.compareAtPrice && variant.compareAtPrice > variant.price && (
                <span className="ml-2 text-base font-normal text-muted-foreground line-through">
                  {formatDZD(variant.compareAtPrice)}
                </span>
              )}
            </p>

            {sizes.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-sm font-medium">Taille</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <Button
                      key={size}
                      size="sm"
                      variant={variant?.attributes?.size === size ? "default" : "outline"}
                      onClick={() => {
                        const v =
                          product.variants.find(
                            (v) =>
                              v.attributes?.size === size &&
                              (!variant?.attributes?.color ||
                                v.attributes?.color === variant.attributes.color)
                          ) ?? product.variants.find((v) => v.attributes?.size === size);
                        if (v) setVariantId(v.id);
                      }}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {colors.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-sm font-medium">Couleur</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <Button
                      key={color}
                      size="sm"
                      variant={variant?.attributes?.color === color ? "default" : "outline"}
                      onClick={() => {
                        const v =
                          product.variants.find(
                            (v) =>
                              v.attributes?.color === color &&
                              (!variant?.attributes?.size ||
                                v.attributes?.size === variant.attributes.size)
                          ) ?? product.variants.find((v) => v.attributes?.color === color);
                        if (v) setVariantId(v.id);
                      }}
                    >
                      {color}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {product.variants.length > 1 && sizes.length === 0 && colors.length === 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <Button
                    key={v.id}
                    size="sm"
                    variant={v.id === variantId ? "default" : "outline"}
                    onClick={() => setVariantId(v.id)}
                  >
                    {variantLabel(v)}
                  </Button>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <p className="text-sm font-medium">Quantité</p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Minus />
                </Button>
                <span className="w-8 text-center font-semibold">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setQuantity((q) => Math.min(variant?.stockQuantity ?? 1, q + 1))
                  }
                >
                  <Plus />
                </Button>
              </div>
              {variant && (
                <Badge variant={variant.stockQuantity > 0 ? "success" : "destructive"}>
                  {variant.stockQuantity > 0
                    ? `${variant.stockQuantity} en stock`
                    : "Rupture de stock"}
                </Badge>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="flex-1"
                disabled={!variant || variant.stockQuantity < quantity}
                onClick={() => setOrderOpen(true)}
              >
                <Zap /> ⚡ Acheter Maintenant
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1"
                disabled={!variant || variant.stockQuantity < 1}
                onClick={() => {
                  if (!variant) return;
                  addItem({
                    variantId: variant.id,
                    productSlug: product.slug,
                    productName: product.name,
                    variantName: variantLabel(variant),
                    price: variant.price,
                    quantity,
                    image: variant.image ?? product.images[0],
                  });
                  toast.success("Ajouté au panier");
                }}
              >
                <ShoppingCart /> 🛒 Ajouter au Panier
              </Button>
            </div>

            {product.description && (
              <div className="mt-8">
                <h2 className="mb-2 font-semibold">Description</h2>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {product.description}
                </p>
              </div>
            )}

            {product.reviews.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-2 font-semibold">Avis clients</h2>
                <div className="space-y-3">
                  {product.reviews.map((r) => (
                    <div key={r.id} className="rounded-lg border p-3">
                      <p className="flex items-center gap-1 text-sm font-medium">
                        {r.buyer?.fullName ?? "Client"} ·{" "}
                        <span className="flex items-center">
                          {r.rating}
                          <Star className="ml-0.5 h-3 w-3 fill-amber-400 text-amber-400" />
                        </span>
                      </p>
                      {r.title && <p className="mt-1 text-sm font-medium">{r.title}</p>}
                      {r.comment && (
                        <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {variant && (
        <FastOrderDialog
          open={orderOpen}
          onOpenChange={setOrderOpen}
          variantId={variant.id}
          productName={`${product.name} (${variantLabel(variant)})`}
          unitPrice={variant.price}
          quantity={quantity}
        />
      )}
    </>
  );
}
