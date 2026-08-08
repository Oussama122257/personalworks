import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";

const schema = z.object({
  label: z.string().min(1).max(40).optional(),
  fullName: z.string().max(120).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  wilayaCode: z.coerce.number().int().min(1).max(58).optional(),
  communeId: z.coerce.number().int().optional(),
  addressLine: z.string().min(5).max(400).optional(),
  isDefault: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole([]);
  if (error) return error;

  const { id } = await params;
  const owned = await prisma.address.findFirst({
    where: { id, profileId: session.user.id },
  });
  if (!owned) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const wilayaCode = parsed.data.wilayaCode ?? owned.wilayaCode;
  const communeId = parsed.data.communeId ?? owned.communeId;
  const commune = await prisma.commune.findUnique({ where: { id: communeId } });
  if (!commune || commune.wilayaCode !== wilayaCode) {
    return NextResponse.json(
      { error: "La commune ne correspond pas à la wilaya sélectionnée" },
      { status: 400 }
    );
  }

  const address = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.address.updateMany({
        where: { profileId: session.user.id },
        data: { isDefault: false },
      });
    }
    return tx.address.update({ where: { id }, data: parsed.data });
  });

  return NextResponse.json({ success: true, address: serialize(address) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole([]);
  if (error) return error;

  const { id } = await params;
  const owned = await prisma.address.findFirst({
    where: { id, profileId: session.user.id },
  });
  if (!owned) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  await prisma.address.delete({ where: { id } });

  // Promote another address so the buyer always has a default.
  if (owned.isDefault) {
    const next = await prisma.address.findFirst({
      where: { profileId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  return NextResponse.json({ success: true });
}
