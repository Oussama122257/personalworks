import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";

/** Buyer address book. */
export async function GET() {
  const { session, error } = await requireRole([]);
  if (error) return error;

  const addresses = await prisma.address.findMany({
    where: { profileId: session.user.id },
    include: {
      wilaya: { select: { code: true, name: true } },
      commune: { select: { id: true, name: true } },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ addresses: serialize(addresses) });
}

const schema = z.object({
  label: z.string().min(1).max(40).default("Domicile"),
  fullName: z.string().max(120).optional(),
  phone: z.string().max(20).optional(),
  wilayaCode: z.coerce.number().int().min(1).max(58),
  communeId: z.coerce.number().int(),
  addressLine: z.string().min(5).max(400),
  isDefault: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
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

  const commune = await prisma.commune.findUnique({ where: { id: parsed.data.communeId } });
  if (!commune || commune.wilayaCode !== parsed.data.wilayaCode) {
    return NextResponse.json(
      { error: "La commune ne correspond pas à la wilaya sélectionnée" },
      { status: 400 }
    );
  }

  const existing = await prisma.address.count({ where: { profileId: session.user.id } });
  // The first address saved is the default whether or not the box was ticked.
  const makeDefault = parsed.data.isDefault || existing === 0;

  const address = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.address.updateMany({
        where: { profileId: session.user.id },
        data: { isDefault: false },
      });
    }
    return tx.address.create({
      data: { ...parsed.data, isDefault: makeDefault, profileId: session.user.id },
    });
  });

  return NextResponse.json({ success: true, address: serialize(address) }, { status: 201 });
}
