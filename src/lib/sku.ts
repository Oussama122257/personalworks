import { prisma } from "@/lib/prisma";

function token(input: string | null | undefined, length = 3): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, length);
}

/**
 * Builds `{StoreSlug}-{Category}-{Size}-{Color}` and guarantees uniqueness by
 * appending a numeric suffix when the SKU is already taken.
 */
export async function generateSku(params: {
  storeSlug: string;
  category?: string | null;
  size?: string | null;
  color?: string | null;
}): Promise<string> {
  const parts = [
    token(params.storeSlug, 6),
    token(params.category, 3),
    token(params.size, 3),
    token(params.color, 3),
  ].filter(Boolean);

  const base = parts.join("-") || "SKU";

  const existing = await prisma.productVariant.findMany({
    where: { sku: { startsWith: base } },
    select: { sku: true },
  });
  if (!existing.some((v) => v.sku === base)) return base;

  const taken = new Set(existing.map((v) => v.sku));
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}
