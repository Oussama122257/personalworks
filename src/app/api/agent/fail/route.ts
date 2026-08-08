import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { failDelivery, FulfillmentError } from "@/lib/fulfillment";

const FAILURE_REASONS = [
  "BUYER_NOT_HOME",
  "WRONG_ADDRESS",
  "BUYER_UNREACHABLE",
  "ORDER_REFUSED",
  "PACKAGE_DAMAGED",
  "OTHER",
] as const;

const schema = z.object({
  shipmentId: z.string().min(1),
  reason: z.enum(FAILURE_REASONS),
  note: z.string().max(300).optional(),
});

/**
 * AGENT: record a failed delivery attempt.
 * Attempts 1-2 reschedule for the next day; the third returns the parcel and
 * notifies the seller.
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

  try {
    const result = await failDelivery({
      shipmentId: parsed.data.shipmentId,
      agentId: session.user.id,
      reason: parsed.data.reason,
      note: parsed.data.note,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof FulfillmentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[agent/fail] failed", err);
    return NextResponse.json({ error: "Failed to update shipment" }, { status: 500 });
  }
}
