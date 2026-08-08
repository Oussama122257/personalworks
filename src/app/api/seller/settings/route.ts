import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { encryptSecret, maskSecret } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";
import { getPreferences, savePreferences } from "@/lib/preferences";
import { serialize, slugify } from "@/lib/utils";

/** SELLER: full store settings. Credentials are returned masked only. */
export async function GET() {
  const { session, error } = await requireRole(["SELLER"]);
  if (error) return error;

  const store = await prisma.store.findUnique({
    where: { userId: session.user.id },
    include: { wilaya: { select: { code: true, name: true } } },
  });
  if (!store) {
    return NextResponse.json({ error: "No store found" }, { status: 404 });
  }

  const { customApiKey, customApiSecret, ...safe } = store;
  return NextResponse.json({
    store: {
      ...(serialize(safe) as Record<string, unknown>),
      customApiKeyMasked: maskSecret(customApiKey),
      customApiSecretMasked: maskSecret(customApiSecret),
      hasCustomCredentials: Boolean(customApiKey),
    },
    preferences: await getPreferences(session.user.id),
  });
}

const schema = z.object({
  // A — store profile
  name: z.string().min(2).max(120).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  bannerUrl: z.string().max(500).nullable().optional(),
  description: z.string().max(20000).optional(),
  contactPhone: z.string().max(20).nullable().optional(),
  address: z.string().max(400).optional(),
  socialLinks: z
    .object({
      facebook: z.string().max(300).optional(),
      instagram: z.string().max(300).optional(),
      tiktok: z.string().max(300).optional(),
      youtube: z.string().max(300).optional(),
    })
    .optional(),
  // B — shipping
  deliveryProviderType: z
    .enum(["ZEEM_DEFAULT", "YALIDINE", "ZR_EXPRESS", "POSTE", "CUSTOM"])
    .optional(),
  customProviderName: z.string().max(80).nullable().optional(),
  customApiKey: z.string().max(200).nullable().optional(),
  customApiSecret: z.string().max(200).nullable().optional(),
  customAccountNumber: z.string().max(100).nullable().optional(),
  processingTime: z.enum(["24h", "48h", "72h", "5j"]).optional(),
  freeShippingThreshold: z.coerce.number().min(0).nullable().optional(),
  // C — product defaults
  defaultStockThreshold: z.coerce.number().int().min(0).max(1000).optional(),
  defaultTaxRate: z.coerce.number().min(0).max(100).optional(),
  skuPattern: z.string().max(120).optional(),
  aiDescriptionEnabled: z.boolean().optional(),
  // D — fulfillment
  autoConfirmOrders: z.boolean().optional(),
  autoPrintWaybill: z.boolean().optional(),
  defaultCourier: z.string().max(40).optional(),
  // E — payouts
  rib: z.string().max(40).nullable().optional(),
  minPayoutThreshold: z.coerce.number().min(0).optional(),
  payoutFrequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
  invoiceDetails: z.string().max(2000).nullable().optional(),
  // F — notifications (stored on UserPreferences)
  notifications: z.record(z.string(), z.boolean()).optional(),
  // G — returns
  returnPolicy: z.string().max(20000).nullable().optional(),
  returnWindowDays: z.coerce.number().int().min(0).max(365).optional(),
  returnShippingFee: z.enum(["BUYER_PAYS", "SELLER_PAYS", "FREE"]).optional(),
});

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["SELLER"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const store = await prisma.store.findUnique({ where: { userId: session.user.id } });
  if (!store) {
    return NextResponse.json({ error: "No store found" }, { status: 404 });
  }

  const { notifications, customApiKey, customApiSecret, name, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };

  // Renaming the store regenerates its slug; the old URL stops resolving.
  if (name && name !== store.name) {
    const base = slugify(name) || "store";
    let slug = `${base}-${store.id.slice(-6)}`;
    for (
      let i = 2;
      await prisma.store.findFirst({ where: { slug, NOT: { id: store.id } } });
      i++
    ) {
      slug = `${base}-${store.id.slice(-6)}-${i}`;
    }
    data.name = name;
    data.slug = slug;
  }

  // Encrypt before persisting; an empty string clears the credential.
  if (customApiKey !== undefined) {
    data.customApiKey = customApiKey ? encryptSecret(customApiKey) : null;
  }
  if (customApiSecret !== undefined) {
    data.customApiSecret = customApiSecret ? encryptSecret(customApiSecret) : null;
  }

  const updated = await prisma.store.update({ where: { id: store.id }, data });

  if (notifications) {
    await savePreferences(session.user.id, { notifications });
  }

  await recordAudit({
    actor: { id: session.user.id, role: "SELLER" },
    action: "UPDATE",
    entity: "STORE",
    entityId: store.id,
    oldState: { name: store.name, slug: store.slug, provider: store.deliveryProviderType },
    newState: { name: updated.name, slug: updated.slug, provider: updated.deliveryProviderType },
    req,
  });

  const { customApiKey: k, customApiSecret: s, ...safe } = updated;
  return NextResponse.json({
    success: true,
    store: {
      ...(serialize(safe) as Record<string, unknown>),
      customApiKeyMasked: maskSecret(k),
      hasCustomCredentials: Boolean(k),
    },
  });
}
