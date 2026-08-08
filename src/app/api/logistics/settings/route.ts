import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { getSettings, saveSettings } from "@/lib/settings";

/** LOGISTICS/ADMIN: delivery rules, priority fees and surcharges. */
export async function GET() {
  const { error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;
  return NextResponse.json({ logistics: await getSettings("logistics") });
}

const schema = z.object({
  maxDeliveryRadiusKm: z.coerce.number().min(1).max(2000).optional(),
  autoAssignAgent: z.boolean().optional(),
  smartRouting: z.boolean().optional(),
  smsAlertOnAssignment: z.boolean().optional(),
  expressFeePct: z.coerce.number().min(0).max(500).optional(),
  weekendSurcharge: z.coerce.number().min(0).max(100000).optional(),
  heavyItemKgThreshold: z.coerce.number().min(0).max(1000).optional(),
  heavyItemSurcharge: z.coerce.number().min(0).max(100000).optional(),
});

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const logistics = await saveSettings("logistics", parsed.data, session.user.id);

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: "logistics",
    newState: parsed.data,
    req,
  });

  return NextResponse.json({ success: true, logistics });
}
