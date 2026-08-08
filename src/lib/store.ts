"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// App/session store
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: string;
  wilayaCode: number | null;
}

interface AppState {
  user: SessionUser | null;
  role: string | null;
  isLoading: boolean;
  wilaya: number | null;
  setUser: (user: SessionUser | null) => void;
  setRole: (role: string | null) => void;
  setWilaya: (wilaya: number | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  role: null,
  isLoading: true,
  wilaya: null,
  setUser: (user) => set({ user, role: user?.role ?? null }),
  setRole: (role) => set({ role }),
  setWilaya: (wilaya) => set({ wilaya }),
  setLoading: (isLoading) => set({ isLoading }),
}));

/** Hydrates the store from the NextAuth session endpoint. Call once on load. */
export async function hydrateSession() {
  const { setUser, setLoading } = useAppStore.getState();
  try {
    const res = await fetch("/api/auth/session");
    const data = await res.json();
    setUser(data?.user ?? null);
  } catch {
    setUser(null);
  } finally {
    setLoading(false);
  }
}

// ---------------------------------------------------------------------------
// Cart store (persisted to localStorage — UI state only, orders live in DB)
// ---------------------------------------------------------------------------

export interface CartItem {
  variantId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            };
          }
          return { items: [...state.items, item] };
        }),
      removeItem: (variantId) =>
        set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [] }),
    }),
    { name: "zeem-cart" }
  )
);
