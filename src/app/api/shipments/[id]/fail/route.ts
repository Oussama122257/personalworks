import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { processDeliveryFailure, FulfillmentError } from "@/lib/fulfillment";

const failSchema = z.object({
  reason: z.string().min(2).max(200),
});

/** AGENT-only: mark a delivery attempt as failed with a reason. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(["agent"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = failSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await processDeliveryFailure({
      shipmentId: id,
      agentId: session.user.id,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof FulfillmentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[shipments/fail] failed", err);
    return NextResponse.json({ error: "Failed to update shipment" }, { status: 500 });
  }
}
