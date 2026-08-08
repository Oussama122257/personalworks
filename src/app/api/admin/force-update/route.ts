import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { serialize } from "@/lib/utils";

/**
 * God Mode: the admin edits any product or order directly, bypassing the
 * seller-ownership checks every other route enforces. A `reason` is mandatory
 * and lands in the audit log alongside before/after snapshots.
 */

const orderUpdateSchema = z.object({
  entity: z.literal("order"),
  id: z.string().min(1),
  reason: z.string().min(3).max(300),
  data: z.object({
    status: z
      .enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"])
      .optional(),
    totalAmount: z.coerce.number().min(0).optional(),
  }),
});

const productUpdateSchema = z.object({
  entity: z.literal("product"),
  id: z.string().min(1),
  reason: z.string().min(3).max(300),
  data: z.object({
    name: z.string().min(2).optional(),
    category: z.string().min(2).optional(),
    isPublished: z.boolean().optional(),
    price: z.coerce.number().min(1).optional(),
    stockQuantity: z.coerce.number().int().min(0).optional(),
  }),
});

const schema = z.discriminatedUnion("entity", [orderUpdateSchema, productUpdateSchema]);

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload — a reason is mandatory for God Mode edits",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }
  const { entity, id, data, reason } = parsed.data;
  const actor = { id: session.user.id, role: "ADMIN" };

  if (entity === "order") {
    const before = await prisma.order.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const after = await prisma.order.update({ where: { id }, data });
    await recordAudit({
      actor,
      action: "STATUS_CHANGE",
      entity: "ORDER",
      entityId: id,
      oldState: { status: before.status, totalAmount: before.totalAmount },
      newState: { status: after.status, totalAmount: after.totalAmount },
      reason,
      req,
    });
    return NextResponse.json({ success: true, order: serialize(after) });
  }

  // Product edits may carry variant-level price/stock overrides.
  const { price, stockQuantity, ...productFields } = data;
  const before = await prisma.product.findUnique({
    where: { id },
    include: { variants: true },
  });
  if (!before) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: productFields,
      include: { variants: true },
    });
    if (price !== undefined || stockQuantity !== undefined) {
      await tx.productVariant.updateMany({
        where: { productId: id },
        data: {
          ...(price !== undefined ? { price } : {}),
          ...(stockQuantity !== undefined ? { stockQuantity } : {}),
        },
      });
    }
    return tx.product.findUnique({ where: { id }, include: { variants: true } }) ?? updated;
  });

  await recordAudit({
    actor,
    action: "UPDATE",
    entity: "PRODUCT",
    entityId: id,
    oldState: serialize(before),
    newState: serialize(after),
    reason,
    req,
  });

  return NextResponse.json({ success: true, product: serialize(after) });
}
