import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { getSettings, saveSettings } from "@/lib/settings";

/** ERP/ADMIN: import-export defaults and AI auto-tagging. */
export async function GET() {
  const { error } = await requireRole(["ERP_MANAGER", "ADMIN"]);
  if (error) return error;
  return NextResponse.json({ erp: await getSettings("erp") });
}

const schema = z.object({
  csvDelimiter: z.enum([",", ";"]).optional(),
  autoPublishImported: z.boolean().optional(),
  exportFilenamePattern: z.string().max(120).optional(),
  exportFields: z.array(z.string().max(60)).max(40).optional(),
  aiAutoTagging: z.boolean().optional(),
  aiConfidenceThreshold: z.coerce.number().min(0).max(100).optional(),
});

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["ERP_MANAGER", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const erp = await saveSettings("erp", parsed.data, session.user.id);

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: "erp",
    newState: parsed.data,
    req,
  });

  return NextResponse.json({ success: true, erp });
}
