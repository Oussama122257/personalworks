import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { broadcast } from "@/lib/realtime";

const schema = z.object({
  shipmentId: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().int().min(0).max(100000).optional(),
});

/**
 * AGENT: GPS ping. Stores the position and broadcasts it to the buyer's
 * tracking page over the order-reference channel.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["AGENT"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { shipmentId, lat, lng, accuracy } = parsed.data;

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true, agentId: true, order: { select: { reference: true } } },
  });
  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }
  if (shipment.agentId && shipment.agentId !== session.user.id) {
    return NextResponse.json(
      { error: "Shipment is assigned to another agent" },
      { status: 403 }
    );
  }

  const update = await prisma.deliveryLocationUpdate.create({
    data: { shipmentId, lat, lng, accuracy, agentId: session.user.id },
  });

  await broadcast(`track-${shipment.order.reference}`, "location:update", {
    shipmentId,
    lat,
    lng,
    accuracy: accuracy ?? null,
    at: update.createdAt.toISOString(),
  });

  return NextResponse.json({ success: true });
}
