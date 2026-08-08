import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { encryptSecret, maskSecret } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";
import { serialize } from "@/lib/utils";

/**
 * SELLER: own store. Courier credentials are stored encrypted and are never
 * returned in full — the client only ever sees a masked tail.
 */
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
  });
}

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  address: z.string().max(300).optional(),
  rib: z.string().max(40).optional(),
  deliveryProviderType: z
    .enum(["ZEEM_DEFAULT", "YALIDINE", "ZR_EXPRESS", "POSTE", "CUSTOM"])
    .optional(),
  customApiKey: z.string().max(200).nullable().optional(),
  customApiSecret: z.string().max(200).nullable().optional(),
  customAccountNumber: z.string().max(100).nullable().optional(),
});

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["SELLER"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
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

  const { customApiKey, customApiSecret, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };

  // Encrypt before persisting; an empty string clears the credential.
  if (customApiKey !== undefined) {
    data.customApiKey = customApiKey ? encryptSecret(customApiKey) : null;
  }
  if (customApiSecret !== undefined) {
    data.customApiSecret = customApiSecret ? encryptSecret(customApiSecret) : null;
  }

  const updated = await prisma.store.update({ where: { id: store.id }, data });

  await recordAudit({
    actor: { id: session.user.id, role: "SELLER" },
    action: "UPDATE",
    entity: "STORE",
    entityId: store.id,
    oldState: { deliveryProviderType: store.deliveryProviderType },
    newState: { deliveryProviderType: updated.deliveryProviderType },
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
