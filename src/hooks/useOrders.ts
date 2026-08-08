"use client";

import { useQuery } from "@tanstack/react-query";

export interface OrderDTO {
  id: string;
  reference: string;
  guestName?: string | null;
  phone: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  shippingFee: number;
  address: string;
  status: string;
  createdAt: string;
  store: { id: string; name: string };
  variant: { name: string; product: { name: string; slug: string } };
  wilaya: { nameFr: string };
  commune: { name: string };
  shipment?: { id: string; status: string; trackingNumber: string } | null;
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
