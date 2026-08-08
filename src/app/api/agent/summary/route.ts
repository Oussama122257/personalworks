import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { round2 } from "@/lib/utils";

/** AGENT: today's zone, collected total and task split (pickups vs deliveries). */
export async function GET() {
  const { session, error } = await requireRole(["AGENT"]);
  if (error) return error;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [wilaya, todayDelivered, tasks] = await Promise.all([
    session.user.wilayaCode
      ? prisma.wilaya.findUnique({
          where: { code: session.user.wilayaCode },
          select: { name: true },
        })
      : null,
    prisma.shipment.aggregate({
      _sum: { actualCollected: true },
      _count: { id: true },
      where: {
        agentId: session.user.id,
        status: "DELIVERED_COD_COLLECTED",
        deliveredAt: { gte: startOfDay },
      },
    }),
    prisma.shipment.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { agentId: session.user.id },
    }),
  ]);

  const counts = Object.fromEntries(tasks.map((t) => [t.status, t._count.id]));

  return NextResponse.json({
    zone: wilaya?.name ?? "Toutes zones",
    collectedToday: round2(todayDelivered._sum.actualCollected ?? 0),
    deliveredToday: todayDelivered._count.id,
    pickupsPending: counts.PENDING_PICKUP ?? 0,
    inTransit: (counts.PICKED_UP ?? 0) + (counts.IN_TRANSIT ?? 0) + (counts.OUT_FOR_DELIVERY ?? 0),
    failed: counts.FAILED ?? 0,
  });
}
