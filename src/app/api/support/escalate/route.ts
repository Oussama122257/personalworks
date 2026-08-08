import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { notify, templates } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";

/**
 * Escalation sweep: any ticket left OPEN longer than the SLA is flagged, an
 * audit entry is written and the admins are notified.
 *
 * Threshold comes from SUPPORT_ESCALATION_HOURS (default 24). Like the courier
 * health check this needs an external scheduler — call it with the
 * `x-cron-secret` header, or run it manually from the support dashboard.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  const viaCron = Boolean(cronSecret && headerSecret && headerSecret === cronSecret);

  let actorId: string | null = null;
  if (!viaCron) {
    const { session, error } = await requireRole(["SUPPORT", "ADMIN"]);
    if (error) return error;
    actorId = session.user.id;
  }

  // Threshold comes from the support settings page; the env var is the
  // fallback for a fresh install that has never saved settings.
  const supportSettings = await getSettings("support");
  const hours =
    supportSettings.escalateAfterHours ||
    Number(process.env.SUPPORT_ESCALATION_HOURS ?? 24);
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const stale = await prisma.supportTicket.findMany({
    where: { status: "OPEN", escalatedAt: null, createdAt: { lt: cutoff } },
    select: { id: true, reference: true, subject: true, createdAt: true },
  });

  if (stale.length === 0) {
    return NextResponse.json({ success: true, escalated: 0, thresholdHours: hours });
  }

  const admins = await prisma.profile.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, phone: true },
  });
  // Audit rows need an actor; fall back to the first admin for cron runs.
  const auditActor = actorId ?? admins[0]?.id;

  await prisma.$transaction(async (tx) => {
    await tx.supportTicket.updateMany({
      where: { id: { in: stale.map((t) => t.id) } },
      data: { escalatedAt: new Date(), priority: "URGENT" },
    });

    if (auditActor) {
      await tx.auditLog.createMany({
        data: stale.map((t) => ({
          userId: auditActor,
          userRole: "ADMIN" as const,
          action: "STATUS_CHANGE",
          entity: "SETTINGS",
          entityId: t.id,
          newState: {
            escalated: true,
            reference: t.reference,
            openedAt: t.createdAt.toISOString(),
          },
          reason: `Ticket ouvert depuis plus de ${hours}h sans résolution`,
        })),
      });
    }
  });

  for (const admin of admins) {
    const tpl = templates.ticketEscalated(
      stale.map((t) => t.reference).join(", "),
      hours
    );
    await notify({
      email: admin.email,
      phone: admin.phone,
      subject: tpl.subject,
      body: tpl.body,
    });
  }

  return NextResponse.json({
    success: true,
    escalated: stale.length,
    thresholdHours: hours,
    references: stale.map((t) => t.reference),
  });
}
