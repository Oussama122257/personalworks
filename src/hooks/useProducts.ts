"use client";

import { useQuery } from "@tanstack/react-query";

export interface ProductVariantDTO {
  id: string;
  sku: string;
  name: string;
  size?: string | null;
  color?: string | null;
  price: number;
  stockQuantity: number;
}

export interface ProductDTO {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category: string;
  images: string[];
  basePrice: number;
  lowStockThreshold: number;
  isPublished: boolean;
  variants: ProductVariantDTO[];
  store: { id: string; name: string; slug: string; wilayaCode: number };
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
