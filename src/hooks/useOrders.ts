"use client";

import { useQuery } from "@tanstack/react-query";
import type { VariantAttributes } from "@/hooks/useProducts";

export interface OrderItemDTO {
  id: string;
  quantity: number;
  price: number;
  sellerId: string;
  variant: {
    sku: string;
    attributes: VariantAttributes;
    product: { name: string; slug: string };
  };
}

export interface OrderShipmentDTO {
  id: string;
  status: string;
  trackingNumber?: string | null;
  codAmount: number;
  shippingFee: number;
  seller: { id: string; name: string };
}

export interface OrderDTO {
  id: string;
  reference: string;
  guestName?: string | null;
  guestPhone?: string | null;
  totalAmount: number;
  platformFee: number;
  status: string;
  checkoutType: string;
  address: string;
  createdAt: string;
  buyer?: { fullName: string } | null;
  wilaya?: { name: string } | null;
  items: OrderItemDTO[];
  shipments: OrderShipmentDTO[];
}

export function useOrders(params?: { status?: string }) {
  const qs = params?.status ? `?status=${params.status}` : "";
  return useQuery<OrderDTO[]>({
    queryKey: ["orders", params?.status ?? "all"],
    queryFn: async () => {
      const res = await fetch(`/api/orders${qs}`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      return data.orders;
    },
  });
}
