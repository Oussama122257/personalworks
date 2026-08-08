import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

/** ADMIN-only: recent audit log entries. */
export async function GET() {
  const { error } = await requireRole(["admin"]);
  if (error) return error;

  const logs = await prisma.auditLog.findMany({
    include: { actor: { select: { fullName: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      actor: l.actor?.fullName ?? "system",
      actorRole: l.actor?.role ?? "—",
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      after: l.after,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
