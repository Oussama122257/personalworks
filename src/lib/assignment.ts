import { prisma } from "@/lib/prisma";

/**
 * Smart agent assignment.
 *
 * Picks the agent for a shipment's destination wilaya, preferring:
 *   1. fewest pending deliveries (load balancing), then
 *   2. closest last-known GPS position to the destination, when known.
 *
 * Returns null when no active agent covers the wilaya — the shipment stays
 * unassigned and shows up in the pool every agent in that wilaya can see.
 */

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function pickAgentForWilaya(
  wilayaCode: number,
  destination?: { lat: number; lng: number } | null
): Promise<string | null> {
  const agents = await prisma.profile.findMany({
    where: { role: "AGENT", wilayaCode },
    select: { id: true },
  });
  if (agents.length === 0) return null;

  const agentIds = agents.map((a) => a.id);

  const [loads, lastPositions] = await Promise.all([
    prisma.shipment.groupBy({
      by: ["agentId"],
      _count: { id: true },
      where: {
        agentId: { in: agentIds },
        status: { in: ["PENDING_PICKUP", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"] },
      },
    }),
    destination
      ? prisma.deliveryLocationUpdate.findMany({
          where: { agentId: { in: agentIds } },
          orderBy: { createdAt: "desc" },
          distinct: ["agentId"],
          select: { agentId: true, lat: true, lng: true },
        })
      : Promise.resolve([]),
  ]);

  const loadByAgent = new Map(loads.map((l) => [l.agentId as string, l._count.id]));
  const posByAgent = new Map(lastPositions.map((p) => [p.agentId, p]));

  const ranked = agentIds
    .map((id) => {
      const pos = posByAgent.get(id);
      return {
        id,
        load: loadByAgent.get(id) ?? 0,
        distance:
          destination && pos ? haversineKm(destination, { lat: pos.lat, lng: pos.lng }) : null,
      };
    })
    .sort((a, b) => {
      if (a.load !== b.load) return a.load - b.load;
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return 0;
    });

  return ranked[0]?.id ?? null;
}

/** Assigns any unassigned shipments in a wilaya. Returns how many were routed. */
export async function autoAssignPending(wilayaCode?: number): Promise<number> {
  const pending = await prisma.shipment.findMany({
    where: {
      agentId: null,
      status: "PENDING_PICKUP",
      ...(wilayaCode ? { order: { wilayaCode } } : {}),
    },
    select: { id: true, order: { select: { wilayaCode: true, lat: true, lng: true } } },
    take: 200,
  });

  let assigned = 0;
  for (const s of pending) {
    const code = s.order.wilayaCode;
    if (!code) continue;
    const destination =
      s.order.lat !== null && s.order.lng !== null
        ? { lat: s.order.lat, lng: s.order.lng }
        : null;
    const agentId = await pickAgentForWilaya(code, destination);
    if (!agentId) continue;
    await prisma.shipment.update({ where: { id: s.id }, data: { agentId } });
    assigned++;
  }
  return assigned;
}
