import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { completeDelivery, FulfillmentError } from "@/lib/fulfillment";

const schema = z.object({
  shipmentId: z.string().min(1),
  collectedAmount: z.coerce.number().min(0),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * AGENT: the money endpoint. Confirms delivery, records the collected cash and
 * runs completeDelivery() — commission split, seller payout, store balance,
 * loyalty points and the server-side pixel event.
 */
export async function PUT(req: NextRequest) {
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

  try {
    const result = await completeDelivery({
      shipmentId: parsed.data.shipmentId,
      agentId: session.user.id,
      collectedAmount: parsed.data.collectedAmount,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    });
    return NextResponse.json({ success: true, settlement: result.settlement });
  } catch (err) {
    if (err instanceof FulfillmentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[agent/deliver] failed", err);
    return NextResponse.json({ error: "Delivery processing failed" }, { status: 500 });
  }
}
