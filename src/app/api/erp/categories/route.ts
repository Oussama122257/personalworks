import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { slugify } from "@/lib/utils";

/** ERP: category tree (nested). */
export async function GET() {
  const { error } = await requireRole(["ERP_MANAGER", "ADMIN"]);
  if (error) return error;

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  type Node = (typeof categories)[number] & { children: Node[] };
  const byId = new Map<string, Node>(
    categories.map((c) => [c.id, { ...c, children: [] as Node[] }])
  );
  const roots: Node[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return NextResponse.json({ categories: roots, flat: categories });
}

const createSchema = z.object({
  name: z.string().min(2).max(80),
  parentId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole(["ERP_MANAGER", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const siblings = await prisma.category.count({
    where: { parentId: parsed.data.parentId ?? null },
  });

  const base = slugify(parsed.data.name) || "categorie";
  let slug = base;
  for (let i = 2; await prisma.category.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  const category = await prisma.category.create({
    data: {
      name: parsed.data.name,
      slug,
      parentId: parsed.data.parentId ?? null,
      position: siblings,
    },
  });

  return NextResponse.json({ success: true, category }, { status: 201 });
}

const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string(), position: z.number().int().min(0), parentId: z.string().nullable() })),
});

/** ERP: persist a new drag-and-drop ordering. */
export async function PUT(req: NextRequest) {
  const { error } = await requireRole(["ERP_MANAGER", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.items.map((i) =>
      prisma.category.update({
        where: { id: i.id },
        data: { position: i.position, parentId: i.parentId },
      })
    )
  );

  return NextResponse.json({ success: true });
}
