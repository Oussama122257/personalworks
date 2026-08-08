import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";

const orderUpdateSchema = z.object({
  entity: z.literal("order"),
  id: z.string().min(1),
  data: z.object({
    status: z
      .enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED", "FAILED"])
      .optional(),
    totalAmount: z.coerce.number().min(0).optional(),
  }),
});

const productUpdateSchema = z.object({
  entity: z.literal("product"),
  id: z.string().min(1),
  data: z.object({
    name: z.string().min(2).optional(),
    basePrice: z.coerce.number().min(1).optional(),
    isPublished: z.boolean().optional(),
  }),
});

const schema = z.discriminatedUnion("entity", [orderUpdateSchema, productUpdateSchema]);

/** ADMIN-only "god mode": force-edit an order or product, fully audited. */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["admin"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { entity, id, data } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    if (entity === "order") {
      const before = await tx.order.findUnique({ where: { id } });
      if (!before) return null;
      const after = await tx.order.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "ADMIN_FORCE_UPDATE_ORDER",
          entityType: "Order",
          entityId: id,
          before: { status: before.status, totalAmount: Number(before.totalAmount) },
          after: { status: after.status, totalAmount: Number(after.totalAmount) },
        },
      });
      return after;
    }
    const before = await tx.product.findUnique({ where: { id } });
    if (!before) return null;
    const after = await tx.product.update({ where: { id }, data });
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "ADMIN_FORCE_UPDATE_PRODUCT",
        entityType: "Product",
        entityId: id,
        before: {
          name: before.name,
          basePrice: Number(before.basePrice),
          isPublished: before.isPublished,
        },
        after: {
          name: after.name,
          basePrice: Number(after.basePrice),
          isPublished: after.isPublished,
        },
      },
    });
    return after;
  });

  if (!result) {
    return NextResponse.json({ error: `${entity} not found` }, { status: 404 });
  }
  return NextResponse.json({ success: true, [entity]: serialize(result) });
}
