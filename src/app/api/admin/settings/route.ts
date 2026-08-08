import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { getAllSettings, saveSettings, type SettingsMap } from "@/lib/settings";

/** ADMIN: read every platform settings group. */
export async function GET() {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;
  return NextResponse.json({ settings: await getAllSettings() });
}

const generalSchema = z.object({
  platformName: z.string().min(1).max(60),
  defaultCommissionRate: z.coerce.number().min(0).max(100),
  ownerShare: z.coerce.number().min(0).max(100),
  managerShare: z.coerce.number().min(0).max(100),
  defaultCurrency: z.enum(["DZD", "EUR", "USD"]),
  defaultLanguage: z.enum(["fr", "ar", "en"]),
  maintenanceMode: z.boolean(),
});

const featuresSchema = z.object({
  aiSearch: z.boolean(),
  aiProductDescription: z.boolean(),
  aiSizeRecommender: z.boolean(),
  loyaltyPoints: z.boolean(),
  wishlist: z.boolean(),
  reviewsWithPhotos: z.boolean(),
  guestCheckout: z.boolean(),
  multiVendorCart: z.boolean(),
});

const shippingSchema = z.object({
  defaultShippingCompany: z.enum(["YALIDINE", "ZR_EXPRESS", "POSTE"]),
  freeShippingThreshold: z.coerce.number().min(0),
  maxDeliveryAttempts: z.coerce.number().int().min(1).max(10),
  autoCancelAfterDays: z.coerce.number().int().min(1).max(365),
});

const themeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoLight: z.string().nullable(),
  logoDark: z.string().nullable(),
  favicon: z.string().nullable(),
  customCss: z.string().max(20000),
});

const bodySchema = z.discriminatedUnion("group", [
  z.object({ group: z.literal("general"), values: generalSchema.partial() }),
  z.object({ group: z.literal("features"), values: featuresSchema.partial() }),
  z.object({ group: z.literal("shipping"), values: shippingSchema.partial() }),
  z.object({ group: z.literal("theme"), values: themeSchema.partial() }),
]);

/** ADMIN: update one settings group. */
export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { group, values } = parsed.data;

  // The commission split must total 100% or the fulfillment maths silently
  // loses (or invents) money on every delivery.
  if (group === "general") {
    const v = values as Partial<SettingsMap["general"]>;
    if (v.ownerShare !== undefined || v.managerShare !== undefined) {
      const current = (await getAllSettings()).general;
      const owner = v.ownerShare ?? current.ownerShare;
      const manager = v.managerShare ?? current.managerShare;
      if (Math.abs(owner + manager - 100) > 0.01) {
        return NextResponse.json(
          {
            error: `La part propriétaire (${owner}%) et la part manager (${manager}%) doivent totaliser 100%.`,
          },
          { status: 400 }
        );
      }
    }
  }

  const before = (await getAllSettings())[group];
  const next = await saveSettings(group, values as never, session.user.id);

  await recordAudit({
    actor: { id: session.user.id, role: "ADMIN" },
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: group,
    oldState: before,
    newState: next,
    req,
  });

  return NextResponse.json({ success: true, settings: next });
}
