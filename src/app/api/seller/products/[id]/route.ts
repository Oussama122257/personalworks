import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";

async function ownProduct(userId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, store: { ownerId: userId } },
    include: { variants: true },
  });
}

const variantUpdateSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1).max(60),
  name: z.string().min(1),
  size: z.string().optional(),
  color: z.string().optional(),
  price: z.coerce.number().min(1),
  stockQuantity: z.coerce.number().int().min(0),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().min(2).optional(),
  images: z.array(z.string()).max(8).optional(),
  basePrice: z.coerce.number().min(1).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  variants: z.array(variantUpdateSchema).optional(),
});

/** SELLER-only: update a product (and upsert its variants). */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(["seller"]);
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
        if (v.id) {
          await tx.productVariant.update({
            where: { id: v.id, productId: id },
            data: { sku: v.sku, name: v.name, size: v.size, color: v.color, price: v.price, stockQuantity: v.stockQuantity },
          });
        } else {
          await tx.productVariant.create({ data: { ...v, productId: id } });
        }
      }
    }
    return updated;
  });

  return NextResponse.json({ success: true, product: serialize(updated) });
}

/** SELLER-only: delete a product. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(["seller"]);
  if (error) return error;

  const { id } = await params;
  const product = await ownProduct(session.user.id, id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const orderCount = await prisma.order.count({
    where: { variant: { productId: id } },
  });
  if (orderCount > 0) {
    // Products with order history are unpublished, not hard-deleted.
    await prisma.product.update({ where: { id }, data: { isPublished: false } });
    return NextResponse.json({ success: true, archived: true });
  }

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
