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
  const { session, error } = await requireRole(["WILAYA_MANAGER", "ADMIN"]);
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
    session.user.role === "WILAYA_MANAGER" &&
    session.user.wilayaCode !== store.wilayaCode
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isActive = parsed.data.action === "approve";

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.store.update({
      where: { id },
      data: {
        isActive,
        // approvedBy records who took the decision (approval or rejection),
        // distinguishing decided stores from still-pending ones.
        approvedBy: session.user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        userRole: session.user.role as "WILAYA_MANAGER" | "ADMIN",
        action: "STATUS_CHANGE",
        entity: "STORE",
        entityId: id,
        oldState: { isActive: store.isActive },
        newState: { isActive, decision: parsed.data.action },
      },
    });
    return updated;
  });

  return NextResponse.json({ success: true, store: serialize(updated) });
}
