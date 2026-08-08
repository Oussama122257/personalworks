"use client";

import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDZD } from "@/lib/utils";
import type { ProductDTO } from "@/hooks/useProducts";

export function ProductCard({ product }: { product: ProductDTO }) {
  const minPrice = Math.min(...product.variants.map((v) => v.price));
  const inStock = product.variants.some((v) => v.stockQuantity > 0);

  return (
    <Link href={`/products/${product.slug}`}>
      <Card className="group h-full overflow-hidden transition-shadow hover:shadow-lg">
        <div className="relative flex aspect-square items-center justify-center bg-muted">
          {product.images[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <Package className="h-12 w-12 text-muted-foreground" />
          )}
          {!inStock && (
            <Badge variant="destructive" className="absolute left-2 top-2">
              Rupture de stock
            </Badge>
          )}
        </div>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">{product.store.name}</p>
          <h3 className="line-clamp-2 font-medium">{product.name}</h3>
          <p className="mt-1 font-bold text-primary">{formatDZD(minPrice)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
