import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { autoAssignPending } from "@/lib/assignment";
import { round2 } from "@/lib/utils";

/** LOGISTICS/ADMIN: agent performance board. */
export async function GET() {
  const { error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const agents = await prisma.profile.findMany({
    where: { role: "AGENT" },
    select: { id: true, fullName: true, phone: true, wilayaCode: true },
    orderBy: { fullName: "asc" },
  });
  const agentIds = agents.map((a) => a.id);

  const shipments = await prisma.shipment.findMany({
    where: { agentId: { in: agentIds } },
    select: {
      agentId: true,
      status: true,
      createdAt: true,
      deliveredAt: true,
      actualCollected: true,
    },
  });

  const rows = agents.map((a) => {
    const mine = shipments.filter((s) => s.agentId === a.id);
    const delivered = mine.filter((s) => s.status === "DELIVERED_COD_COLLECTED");
    const failed = mine.filter((s) => s.status === "FAILED" || s.status === "RETURNED");
    const today = delivered.filter((s) => s.deliveredAt && s.deliveredAt >= startOfDay);
    const durations = delivered
      .filter((s) => s.deliveredAt)
      .map((s) => (s.deliveredAt!.getTime() - s.createdAt.getTime()) / 3_600_000);
    const terminal = delivered.length + failed.length;

    return {
      agentId: a.id,
      name: a.fullName,
      phone: a.phone,
      wilayaCode: a.wilayaCode,
      deliveriesToday: today.length,
      collectedToday: round2(
        today.reduce((sum, s) => sum + (s.actualCollected ?? 0), 0)
      ),
      totalDelivered: delivered.length,
      successRate: terminal > 0 ? round2((delivered.length / terminal) * 100) : null,
      avgHours:
        durations.length > 0
          ? round2(durations.reduce((s, d) => s + d, 0) / durations.length)
          : null,
      activeTasks: mine.filter((s) =>
        ["PENDING_PICKUP", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(s.status)
      ).length,
    };
  });

  const unassigned = await prisma.shipment.count({
    where: { agentId: null, status: "PENDING_PICKUP" },
  });

  return NextResponse.json({ agents: rows, unassigned });
}

/** LOGISTICS/ADMIN: route unassigned parcels to the least-loaded nearby agent. */
export async function POST(req: NextRequest) {
  const { error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const wilayaCode =
    typeof body?.wilayaCode === "number" ? body.wilayaCode : undefined;

  const assigned = await autoAssignPending(wilayaCode);
  return NextResponse.json({ success: true, assigned });
}
