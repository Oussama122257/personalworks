import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";

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
    isPublished: z.boolean().optional(),
    category: z.string().min(2).optional(),
  }),
});

const schema = z.discriminatedUnion("entity", [orderUpdateSchema, productUpdateSchema]);

/** ADMIN-only "god mode": force-edit an order or product. Reason is mandatory
 *  and every change is written to the audit log. */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload (a reason is mandatory for god-mode edits)", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { entity, id, data, reason } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    if (entity === "order") {
      const before = await tx.order.findUnique({ where: { id } });
      if (!before) return null;
      const after = await tx.order.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          userRole: "ADMIN",
          action: "STATUS_CHANGE",
          entity: "ORDER",
          entityId: id,
          oldState: { status: before.status, totalAmount: before.totalAmount },
          newState: { status: after.status, totalAmount: after.totalAmount },
          reason,
        },
      });
      return after;
    }
    const before = await tx.product.findUnique({ where: { id } });
    if (!before) return null;
    const after = await tx.product.update({ where: { id }, data });
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        userRole: "ADMIN",
        action: "UPDATE",
        entity: "PRODUCT",
        entityId: id,
        oldState: {
          name: before.name,
          isPublished: before.isPublished,
          category: before.category,
        },
        newState: {
          name: after.name,
          isPublished: after.isPublished,
          category: after.category,
        },
        reason,
      },
    });
    return after;
  });

  if (!result) {
    return NextResponse.json({ error: `${entity} not found` }, { status: 404 });
  }
  return NextResponse.json({ success: true, [entity]: serialize(result) });
}
