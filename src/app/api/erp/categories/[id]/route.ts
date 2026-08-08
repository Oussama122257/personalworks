import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  parentId: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["ERP_MANAGER", "ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (parsed.data.parentId === id) {
    return NextResponse.json(
      { error: "Une catégorie ne peut pas être son propre parent" },
      { status: 400 }
    );
  }

  const category = await prisma.category.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, category });
}

/** Soft-delete: the category and its descendants are deactivated. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["ERP_MANAGER", "ADMIN"]);
  if (error) return error;

  const { id } = await params;

  // Walk the subtree so children are deactivated with their parent.
  const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const toDeactivate = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of all) {
      if (c.parentId && toDeactivate.has(c.parentId) && !toDeactivate.has(c.id)) {
        toDeactivate.add(c.id);
        grew = true;
      }
    }
  }

  await prisma.category.updateMany({
    where: { id: { in: [...toDeactivate] } },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true, deactivated: toDeactivate.size });
}
