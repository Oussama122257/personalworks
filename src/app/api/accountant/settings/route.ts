import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { getSettings, saveSettings } from "@/lib/settings";
import { getPreferences, savePreferences } from "@/lib/preferences";

/** ACCOUNTANT/ADMIN: fiscal, payout automation and reconciliation settings. */
export async function GET() {
  const { session, error } = await requireRole(["ACCOUNTANT", "ADMIN"]);
  if (error) return error;

  const [fiscal, payouts, reconciliation, preferences] = await Promise.all([
    getSettings("fiscal"),
    getSettings("payouts"),
    getSettings("reconciliation"),
    getPreferences(session.user.id),
  ]);

  return NextResponse.json({ fiscal, payouts, reconciliation, preferences });
}

const schema = z.object({
  fiscal: z
    .object({
      vatRate: z.coerce.number().min(0).max(100).optional(),
      invoiceFooter: z.string().max(2000).optional(),
      invoiceLogo: z.string().max(500).nullable().optional(),
      invoiceNumberFormat: z.string().max(80).optional(),
    })
    .optional(),
  payouts: z
    .object({
      autoGenerateBatches: z.boolean().optional(),
      batchDay: z
        .enum([
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
          "SUNDAY",
        ])
        .optional(),
      minSellerBalance: z.coerce.number().min(0).optional(),
      bankFileFormat: z.enum(["CSV", "EXCEL", "XML"]).optional(),
      csvDelimiter: z.enum([",", ";", "\t"]).optional(),
    })
    .optional(),
  reconciliation: z
    .object({
      codTolerancePct: z.coerce.number().min(0).max(100).optional(),
      autoFlagDiscrepancies: z.boolean().optional(),
      dailyReminder: z.boolean().optional(),
    })
    .optional(),
});

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["ACCOUNTANT", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.fiscal) {
    await saveSettings("fiscal", parsed.data.fiscal, session.user.id);
  }
  if (parsed.data.payouts) {
    await saveSettings("payouts", parsed.data.payouts, session.user.id);
  }
  if (parsed.data.reconciliation) {
    await saveSettings("reconciliation", parsed.data.reconciliation, session.user.id);
    // The daily reminder toggle is a personal preference, mirrored for clarity.
    if (parsed.data.reconciliation.dailyReminder !== undefined) {
      await savePreferences(session.user.id, {
        notifications: {
          dailyReconciliationReminder: parsed.data.reconciliation.dailyReminder,
        },
      });
    }
  }

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "UPDATE",
    entity: "FINANCE",
    entityId: "accountant-settings",
    newState: parsed.data,
    req,
  });

  return NextResponse.json({ success: true });
}
