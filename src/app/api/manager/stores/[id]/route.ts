import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { notify, templates } from "@/lib/notifications";
import { serialize } from "@/lib/utils";

const decisionSchema = z
  .object({
    action: z.enum(["approve", "reject", "suspend"]),
    reason: z.string().max(500).optional(),
  })
  .refine((d) => d.action === "approve" || (d.reason?.trim().length ?? 0) >= 3, {
    message: "A reason is required when rejecting or suspending a store",
    path: ["reason"],
  });

/** WILAYA_MANAGER/ADMIN: approve, reject or suspend a store in their wilaya. */
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
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const store = await prisma.store.findUnique({
    where: { id },
    include: { user: { select: { email: true, phone: true } } },
  });
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  // Managers act only within their own wilaya.
  if (
    session.user.role === "WILAYA_MANAGER" &&
    session.user.wilayaCode !== store.wilayaCode
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const approved = parsed.data.action === "approve";
  const reason = parsed.data.reason?.trim() ?? null;

  const updated = await prisma.store.update({
    where: { id },
    data: {
      isActive: approved,
      approvedBy: session.user.id,
      rejectionReason: approved ? null : reason,
    },
  });

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "STATUS_CHANGE",
    entity: "STORE",
    entityId: id,
    oldState: { isActive: store.isActive, rejectionReason: store.rejectionReason },
    newState: { isActive: approved, decision: parsed.data.action },
    reason,
    req,
  });

  // Tell the seller — approval is worth an SMS, the rest goes by email.
  const message = approved
    ? templates.storeApproved(store.name)
    : templates.storeRejected(store.name, reason ?? "non précisé");
  await notify({
    email: store.user.email,
    phone: store.user.phone,
    subject: message.subject,
    body: message.body,
    smsToo: approved,
  });

  return NextResponse.json({ success: true, store: serialize(updated) });
}
