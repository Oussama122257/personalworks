import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";

/** LOGISTICS/ADMIN: the full 58-wilaya × 3-courier pricing matrix. */
export async function GET() {
  const { error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const [rates, wilayas] = await Promise.all([
    prisma.shippingRate.findMany({ orderBy: [{ wilayaCode: "asc" }, { courierType: "asc" }] }),
    prisma.wilaya.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  return NextResponse.json({ rates, wilayas });
}

const rateSchema = z.object({
  wilayaCode: z.number().int().min(1).max(58),
  courierType: z.enum(["YALIDINE", "ZR_EXPRESS", "POSTE"]),
  basePrice: z.coerce.number().min(0),
  pricePerKg: z.coerce.number().min(0),
  estimatedDays: z.string().max(10).optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  updates: z.array(rateSchema).min(1).max(200),
  /** Apply the first entry's pricing to every courier of that wilaya. */
  applyToWholeWilaya: z.boolean().default(false),
});

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { updates, applyToWholeWilaya } = parsed.data;

  // Bulk mode: one row edited → every courier in that wilaya follows.
  const effective = applyToWholeWilaya
    ? updates.flatMap((u) =>
        (["YALIDINE", "ZR_EXPRESS", "POSTE"] as const).map((courierType) => ({
          ...u,
          courierType,
        }))
      )
    : updates;

  await prisma.$transaction(
    effective.map((u) =>
      prisma.shippingRate.upsert({
        where: {
          wilayaCode_courierType: {
            wilayaCode: u.wilayaCode,
            courierType: u.courierType,
          },
        },
        update: {
          basePrice: u.basePrice,
          pricePerKg: u.pricePerKg,
          ...(u.estimatedDays ? { estimatedDays: u.estimatedDays } : {}),
          ...(u.isActive !== undefined ? { isActive: u.isActive } : {}),
        },
        create: {
          wilayaCode: u.wilayaCode,
          courierType: u.courierType,
          basePrice: u.basePrice,
          pricePerKg: u.pricePerKg,
          estimatedDays: u.estimatedDays ?? "2-3",
        },
      })
    )
  );

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: "shipping-rates",
    newState: { updated: effective.length, applyToWholeWilaya },
    req,
  });

  return NextResponse.json({ success: true, updated: effective.length });
}
