import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { serialize } from "@/lib/utils";

const schema = z.object({
  action: z.enum(["prepare"]),
});

/**
 * SELLER: mark a parcel prepared and ready for pickup.
 * Only shipments belonging to the seller's own store may be touched.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(["SELLER"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const shipment = await prisma.shipment.findFirst({
    where: { id, seller: { userId: session.user.id } },
  });
  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }
  if (shipment.status !== "PENDING_PICKUP") {
    return NextResponse.json(
      { error: "Ce colis n'est plus en attente de ramassage" },
      { status: 409 }
    );
  }

  const updated = await prisma.shipment.update({
    where: { id },
    data: { status: "PICKED_UP" },
  });
  await prisma.order.update({
    where: { id: shipment.orderId },
    data: { status: "PROCESSING" },
  });

  await recordAudit({
    actor: { id: session.user.id, role: "SELLER" },
    action: "STATUS_CHANGE",
    entity: "ORDER",
    entityId: shipment.orderId,
    oldState: { shipmentStatus: shipment.status },
    newState: { shipmentStatus: "PICKED_UP" },
    req,
  });

  return NextResponse.json({ success: true, shipment: serialize(updated) });
}
