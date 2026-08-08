import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

/** ERP: attribute dictionary (sizes, colours, fabrics). */
export async function GET() {
  const { error } = await requireRole(["ERP_MANAGER", "ADMIN", "SELLER"]);
  if (error) return error;

  const attributes = await prisma.attribute.findMany({
    where: { isActive: true },
    include: { values: { orderBy: { position: "asc" } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ attributes });
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(["SIZE", "COLOR", "FABRIC", "OTHER"]).default("OTHER"),
  values: z.array(z.string().min(1).max(60)).default([]),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole(["ERP_MANAGER", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { name, type, values } = parsed.data;

  const existing = await prisma.attribute.findUnique({
    where: { name_type: { name, type } },
  });
  if (existing) {
    // Merge new values into the existing attribute instead of failing.
    const current = await prisma.attributeValue.findMany({
      where: { attributeId: existing.id },
      select: { value: true },
    });
    const known = new Set(current.map((v) => v.value));
    const additions = values.filter((v) => !known.has(v));
    if (additions.length > 0) {
      await prisma.attributeValue.createMany({
        data: additions.map((value, i) => ({
          attributeId: existing.id,
          value,
          position: known.size + i,
        })),
      });
    }
    const updated = await prisma.attribute.findUnique({
      where: { id: existing.id },
      include: { values: { orderBy: { position: "asc" } } },
    });
    return NextResponse.json({ success: true, attribute: updated, merged: true });
  }

  const attribute = await prisma.attribute.create({
    data: {
      name,
      type,
      values: { create: values.map((value, i) => ({ value, position: i })) },
    },
    include: { values: true },
  });

  return NextResponse.json({ success: true, attribute }, { status: 201 });
}

const deleteSchema = z.object({ valueId: z.string().optional(), attributeId: z.string().optional() });

export async function DELETE(req: NextRequest) {
  const { error } = await requireRole(["ERP_MANAGER", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success || (!parsed.data.valueId && !parsed.data.attributeId)) {
    return NextResponse.json({ error: "valueId or attributeId required" }, { status: 400 });
  }

  if (parsed.data.valueId) {
    await prisma.attributeValue.delete({ where: { id: parsed.data.valueId } });
  } else {
    await prisma.attribute.update({
      where: { id: parsed.data.attributeId! },
      data: { isActive: false },
    });
  }

  return NextResponse.json({ success: true });
}
