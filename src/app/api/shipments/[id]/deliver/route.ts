import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { processDelivery, FulfillmentError } from "@/lib/fulfillment";

const deliverSchema = z.object({
  collectedAmount: z.coerce.number().min(0),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/** AGENT-only: confirm delivery, collect COD, and settle commissions. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(["agent"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = deliverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await processDelivery({
      shipmentId: id,
      agentId: session.user.id,
      collectedAmount: parsed.data.collectedAmount,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    });
    return NextResponse.json({ success: true, settlement: result });
  } catch (err) {
    if (err instanceof FulfillmentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[shipments/deliver] failed", err);
    return NextResponse.json({ error: "Delivery processing failed" }, { status: 500 });
  }
}
