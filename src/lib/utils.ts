import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDZD(amount: number | string) {
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReference(prefix: string) {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return `${prefix}-${out}`;
}

/** Recursively convert Prisma Decimal/Date values into JSON-safe primitives. */
export function serialize<T>(value: T): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    // Prisma Decimal
    if (
      "toNumber" in (value as object) &&
      typeof (value as { toNumber?: unknown }).toNumber === "function"
    ) {
      return (value as unknown as { toNumber: () => number }).toNumber();
    }
    if (Array.isArray(value)) return value.map((v) => serialize(v));
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serialize(v)])
    );
  }
  return value;
}
