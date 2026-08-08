import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { getPreferences, savePreferences } from "@/lib/preferences";

/** WILAYA_MANAGER: regional settings + own payout/notification preferences. */
export async function GET() {
  const { session, error } = await requireRole(["WILAYA_MANAGER"]);
  if (error) return error;

  const wilayaCode = session.user.wilayaCode;
  if (!wilayaCode) {
    return NextResponse.json({ error: "No wilaya assigned" }, { status: 400 });
  }

  const [wilaya, regional, preferences] = await Promise.all([
    prisma.wilaya.findUnique({ where: { code: wilayaCode }, select: { name: true } }),
    prisma.wilayaSettings.findUnique({ where: { wilayaCode } }),
    getPreferences(session.user.id),
  ]);

  return NextResponse.json({
    wilayaCode,
    wilayaName: wilaya?.name ?? "",
    regional: {
      displayName: regional?.displayName ?? "",
      shippingSurcharge: regional?.shippingSurcharge ?? 0,
      autoApproveSellers: regional?.autoApproveSellers ?? false,
    },
    preferences,
  });
}

const schema = z.object({
  regional: z
    .object({
      displayName: z.string().max(80).optional(),
      shippingSurcharge: z.coerce.number().min(0).max(100000).optional(),
      autoApproveSellers: z.boolean().optional(),
    })
    .optional(),
  payout: z
    .object({
      minCommissionPayout: z.coerce.number().min(0).optional(),
      payoutFrequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
      rib: z.string().max(40).optional(),
    })
    .optional(),
  notifications: z.record(z.string(), z.boolean()).optional(),
});

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["WILAYA_MANAGER"]);
  if (error) return error;

  const wilayaCode = session.user.wilayaCode;
  if (!wilayaCode) {
    return NextResponse.json({ error: "No wilaya assigned" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.regional) {
    const before = await prisma.wilayaSettings.findUnique({ where: { wilayaCode } });
    const after = await prisma.wilayaSettings.upsert({
      where: { wilayaCode },
      update: parsed.data.regional,
      create: { wilayaCode, ...parsed.data.regional },
    });
    await recordAudit({
      actor: { id: session.user.id, role: "WILAYA_MANAGER" },
      action: "UPDATE",
      entity: "SETTINGS",
      entityId: `wilaya:${wilayaCode}`,
      oldState: before,
      newState: after,
      req,
    });
  }

  if (parsed.data.payout || parsed.data.notifications) {
    await savePreferences(session.user.id, {
      settings: parsed.data.payout,
      notifications: parsed.data.notifications,
    });
  }

  return NextResponse.json({ success: true });
}
