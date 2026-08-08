import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public live-tracking feed for a buyer's order reference.
 * Returns the latest agent position plus a masked contact number — the
 * agent's real phone is never exposed.
 */
function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\s/g, "");
  if (digits.length <= 4) return "••••";
  return `${digits.slice(0, 2)}•••••${digits.slice(-2)}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  const order = await prisma.order.findUnique({
    where: { reference: reference.toUpperCase() },
    include: {
      shipments: {
        include: {
          locationUpdates: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const agentIds = order.shipments
    .map((s) => s.agentId)
    .filter((id): id is string => Boolean(id));
  const agents = agentIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, fullName: true, phone: true },
      })
    : [];
  const agentById = new Map(agents.map((a) => [a.id, a]));

  return NextResponse.json({
    reference: order.reference,
    status: order.status,
    shipments: order.shipments.map((s) => {
      const agent = s.agentId ? agentById.get(s.agentId) : null;
      const last = s.locationUpdates[0];
      return {
        shipmentId: s.id,
        trackingNumber: s.trackingNumber,
        status: s.status,
        attemptCount: s.attemptCount,
        agentName: agent?.fullName ?? null,
        agentPhoneMasked: maskPhone(agent?.phone),
        location: last
          ? {
              lat: last.lat,
              lng: last.lng,
              accuracy: last.accuracy,
              at: last.createdAt.toISOString(),
            }
          : null,
      };
    }),
  });
}
