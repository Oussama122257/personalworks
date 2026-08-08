import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

/** ADMIN-only: recent audit log entries. */
export async function GET() {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      actor: l.user?.fullName ?? "system",
      actorRole: l.userRole,
      action: l.action,
      entityType: l.entity,
      entityId: l.entityId,
      reason: l.reason,
      after: l.newState,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
