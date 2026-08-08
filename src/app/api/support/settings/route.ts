import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { getSettings, saveSettings } from "@/lib/settings";
import { getPreferences, savePreferences } from "@/lib/preferences";

/** SUPPORT/ADMIN: routing, SLA, escalation and context toggles. */
export async function GET() {
  const { session, error } = await requireRole(["SUPPORT", "ADMIN"]);
  if (error) return error;

  return NextResponse.json({
    support: await getSettings("support"),
    preferences: await getPreferences(session.user.id),
  });
}

const schema = z.object({
  support: z
    .object({
      autoAssignTickets: z.boolean().optional(),
      routingAlgorithm: z.enum(["ROUND_ROBIN", "LEAST_BUSY", "PRIORITY"]).optional(),
      slaHours: z.coerce.number().min(1).max(720).optional(),
      escalateAfterHours: z.coerce.number().min(1).max(720).optional(),
      highPriorityKeywords: z.string().max(1000).optional(),
      autoTagHighPriority: z.boolean().optional(),
      showOrderHistory: z.boolean().optional(),
      showPreviousTickets: z.boolean().optional(),
      allowTestOrders: z.boolean().optional(),
    })
    .optional(),
  notifications: z.record(z.string(), z.boolean()).optional(),
});

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["SUPPORT", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.support) {
    await saveSettings("support", parsed.data.support, session.user.id);
    await recordAudit({
      actor: { id: session.user.id, role: session.user.role },
      action: "UPDATE",
      entity: "SETTINGS",
      entityId: "support",
      newState: parsed.data.support,
      req,
    });
  }
  if (parsed.data.notifications) {
    await savePreferences(session.user.id, { notifications: parsed.data.notifications });
  }

  return NextResponse.json({ success: true });
}
