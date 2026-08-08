import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { decryptSecret } from "@/lib/crypto";
import { testConnection } from "@/lib/couriers";

/**
 * SELLER: validate the stored courier credentials by calling the courier API.
 * Reports `configured: false` when no endpoint is set rather than claiming a
 * success that never happened.
 */
export async function POST(_req: NextRequest) {
  const { session, error } = await requireRole(["SELLER"]);
  if (error) return error;

  const store = await prisma.store.findUnique({ where: { userId: session.user.id } });
  if (!store) {
    return NextResponse.json({ error: "No store found" }, { status: 404 });
  }
  if (store.deliveryProviderType === "ZEEM_DEFAULT") {
    return NextResponse.json(
      { error: "La boutique utilise la flotte Zeem — aucune clé à tester" },
      { status: 400 }
    );
  }

  const courier =
    store.deliveryProviderType === "CUSTOM" ? "YALIDINE" : store.deliveryProviderType;

  const probe = await testConnection(courier, {
    apiKey: decryptSecret(store.customApiKey),
    apiSecret: decryptSecret(store.customApiSecret),
    accountNumber: store.customAccountNumber,
  });

  return NextResponse.json(probe);
}
