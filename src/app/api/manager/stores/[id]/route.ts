import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";

const decisionSchema = z.object({
  action: z.enum(["approve", "reject", "suspend"]),
});

/** WILAYA_MANAGER/ADMIN: approve, reject or suspend a store. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(["wilaya_manager", "admin"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  // Managers can only act on stores in their own wilaya.
  if (
    session.user.role === "wilaya_manager" &&
    session.user.wilayaCode !== store.wilayaCode
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status =
    parsed.data.action === "approve"
      ? "ACTIVE"
      : parsed.data.action === "reject"
        ? "REJECTED"
        : "SUSPENDED";

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.store.update({
      where: { id },
      data: {
        status,
        approvedById: parsed.data.action === "approve" ? session.user.id : store.approvedById,
        approvedAt: parsed.data.action === "approve" ? new Date() : store.approvedAt,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: `STORE_${parsed.data.action.toUpperCase()}`,
        entityType: "Store",
        entityId: id,
        before: { status: store.status },
        after: { status },
      },
    });
    return updated;
  });

  return NextResponse.json({ success: true, store: serialize(updated) });
}
