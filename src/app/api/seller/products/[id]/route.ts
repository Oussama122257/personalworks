import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";

async function ownProduct(userId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, store: { userId } },
    include: { variants: true },
  });
}

const variantUpdateSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1).max(60),
  size: z.string().optional(),
  color: z.string().optional(),
  price: z.coerce.number().min(1),
  compareAtPrice: z.coerce.number().min(0).optional(),
  stockQuantity: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  image: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().min(2).optional(),
  images: z.array(z.string()).max(8).optional(),
  isPublished: z.boolean().optional(),
  variants: z.array(variantUpdateSchema).optional(),
});

/** SELLER-only: update a product (and upsert its variants). */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(["SELLER"]);
  if (error) return error;

  const { id } = await params;
  const product = await ownProduct(session.user.id, id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { variants, ...fields } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id }, data: fields });
    if (variants) {
      for (const v of variants) {
        const data = {
          sku: v.sku,
          attributes: { size: v.size ?? null, color: v.color ?? null },
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          stockQuantity: v.stockQuantity,
          lowStockThreshold: v.lowStockThreshold,
          image: v.image,
        };
        if (v.id) {
          await tx.productVariant.update({
            where: { id: v.id, productId: id },
            data,
          });
        } else {
          await tx.productVariant.create({ data: { ...data, productId: id } });
        }
      }
    }
    return updated;
  });

  return NextResponse.json({ success: true, product: serialize(updated) });
}

/** SELLER-only: delete a product (archived instead if it has order history). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(["SELLER"]);
  if (error) return error;

  const { id } = await params;
  const product = await ownProduct(session.user.id, id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const orderCount = await prisma.orderItem.count({
    where: { variant: { productId: id } },
  });
  if (orderCount > 0) {
    // Products with order history are unpublished, not hard-deleted.
    await prisma.product.update({ where: { id }, data: { isPublished: false } });
    return NextResponse.json({ success: true, archived: true });
  }

  await prisma.$transaction([
    prisma.productVariant.deleteMany({ where: { productId: id } }),
    prisma.review.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
  return NextResponse.json({ success: true });
}
