"use client";

import { useQuery } from "@tanstack/react-query";

export interface CommuneDTO {
  id: number;
  name: string;
}

export interface WilayaDTO {
  code: number;
  name: string;
  nameAr?: string | null;
  communes: CommuneDTO[];
}

export function useWilayas() {
  return useQuery<WilayaDTO[]>({
    queryKey: ["wilayas"],
    staleTime: 1000 * 60 * 60, // geography rarely changes
    queryFn: async () => {
      const res = await fetch("/api/wilayas");
      if (!res.ok) throw new Error("Failed to load wilayas");
      const data = await res.json();
      return data.wilayas;
    },
  });
}
