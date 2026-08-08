"use client";

import { useQuery } from "@tanstack/react-query";

export interface VariantAttributes {
  size?: string | null;
  color?: string | null;
}

export interface ProductVariantDTO {
  id: string;
  sku: string;
  attributes: VariantAttributes;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  image?: string | null;
}

export interface ProductDTO {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  images: string[];
  isPublished: boolean;
  variants: ProductVariantDTO[];
  store: { id: string; name: string; slug: string; wilayaCode: number };
}

/** Human label for a variant, derived from its attributes (falls back to SKU). */
export function variantLabel(v: ProductVariantDTO): string {
  const parts = [v.attributes?.size, v.attributes?.color].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : v.sku;
}

export function useProducts(params: { q?: string; wilayaCode?: number | null; category?: string }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.wilayaCode) search.set("wilayaCode", String(params.wilayaCode));
  if (params.category) search.set("category", params.category);
  const qs = search.toString();

  return useQuery<ProductDTO[]>({
    queryKey: ["products", qs],
    queryFn: async () => {
      const res = await fetch(`/api/products/search${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      return data.products;
    },
  });
}

export function useSellerProducts() {
  return useQuery<ProductDTO[]>({
    queryKey: ["seller-products"],
    queryFn: async () => {
      const res = await fetch("/api/seller/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      return data.products;
    },
  });
}
