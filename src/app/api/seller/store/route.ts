import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";

/** SELLER-only: fetch own store (first store owned). */
export async function GET() {
  const { session, error } = await requireRole(["seller"]);
  if (error) return error;

  const store = await prisma.store.findFirst({
    where: { ownerId: session.user.id },
    include: { wilaya: { select: { code: true, nameFr: true } } },
  });
  if (!store) {
    return NextResponse.json({ error: "No store found" }, { status: 404 });
  }
  return NextResponse.json({ store: serialize(store) });
}

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  shippingProvider: z
    .enum(["ZEEM_DEFAULT", "YALIDINE", "ZR_EXPRESS", "POSTE", "CUSTOM"])
    .optional(),
  shippingApiKey: z.string().max(200).nullable().optional(),
});

/** SELLER-only: update store settings (shipping provider, logo, etc.). */
export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole(["seller"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const store = await prisma.store.findFirst({ where: { ownerId: session.user.id } });
  if (!store) {
    return NextResponse.json({ error: "No store found" }, { status: 404 });
  }

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: parsed.data,
  });

  return NextResponse.json({ success: true, store: serialize(updated) });
}
