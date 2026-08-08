import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize, slugify } from "@/lib/utils";
import { generateSku } from "@/lib/sku";

/** SELLER-only: list own products with variants. */
export async function GET() {
  const { session, error } = await requireRole(["SELLER"]);
  if (error) return error;

  const products = await prisma.product.findMany({
    where: { store: { userId: session.user.id } },
    include: { variants: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ products: serialize(products) });
}

const variantSchema = z.object({
  // Optional: generated as {StoreSlug}-{Category}-{Size}-{Color} when omitted.
  sku: z.string().max(60).optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  price: z.coerce.number().min(1),
  compareAtPrice: z.coerce.number().min(0).optional(),
  stockQuantity: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  image: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().max(5000).optional(),
  category: z.string().min(2).default("General"),
  images: z.array(z.string()).max(8).default([]),
  isPublished: z.boolean().default(true),
  variants: z.array(variantSchema).min(1),
});

/** SELLER-only: create a product with its variants. */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["SELLER"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const store = await prisma.store.findUnique({ where: { userId: session.user.id } });
  if (!store) {
    return NextResponse.json({ error: "No store found" }, { status: 404 });
  }
  if (!store.isActive) {
    return NextResponse.json(
      { error: "Store must be approved before adding products" },
      { status: 403 }
    );
  }

  const slug = `${slugify(data.name)}-${Date.now().toString(36)}`;

  // Fill in any missing SKU before the write so the unique constraint holds.
  const variants = [];
  for (const v of data.variants) {
    variants.push({
      sku:
        v.sku?.trim() ||
        (await generateSku({
          storeSlug: store.slug,
          category: data.category,
          size: v.size,
          color: v.color,
        })),
      attributes: { size: v.size ?? null, color: v.color ?? null },
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      stockQuantity: v.stockQuantity,
      lowStockThreshold: v.lowStockThreshold,
      image: v.image,
    });
  }

  const product = await prisma.product.create({
    data: {
      storeId: store.id,
      name: data.name,
      slug,
      description: data.description,
      category: data.category,
      images: data.images,
      isPublished: data.isPublished,
      variants: { create: variants },
    },
    include: { variants: true },
  });

  return NextResponse.json({ success: true, product: serialize(product) }, { status: 201 });
}
