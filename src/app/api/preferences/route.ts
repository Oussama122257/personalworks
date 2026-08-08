import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { getPreferences, savePreferences } from "@/lib/preferences";

/** Any authenticated user: read own preferences. */
export async function GET() {
  const { session, error } = await requireRole([]);
  if (error) return error;
  return NextResponse.json({ preferences: await getPreferences(session.user.id) });
}

const schema = z.object({
  language: z.enum(["fr", "ar", "en"]).optional(),
  darkMode: z.boolean().optional(),
  promoSms: z.boolean().optional(),
  promoEmail: z.boolean().optional(),
  autoApplyPoints: z.boolean().optional(),
  defaultOrderFilter: z.enum(["ALL", "PENDING", "DELIVERED", "CANCELLED"]).optional(),
  showCodBanner: z.boolean().optional(),
  notifications: z.record(z.string(), z.boolean()).optional(),
  settings: z
    .object({
      minCommissionPayout: z.coerce.number().min(0).optional(),
      payoutFrequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
      rib: z.string().max(40).optional(),
      gpsEnabled: z.boolean().optional(),
      gpsPingIntervalSec: z.coerce.number().int().min(10).max(600).optional(),
      showDistance: z.boolean().optional(),
      autoSubmitEod: z.boolean().optional(),
      eodReportTime: z.string().max(5).optional(),
      cashDropOffLocation: z.string().max(200).optional(),
    })
    .optional(),
});

/** Any authenticated user: update own preferences. */
export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole([]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const preferences = await savePreferences(session.user.id, parsed.data);
  return NextResponse.json({ success: true, preferences });
}
