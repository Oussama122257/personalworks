import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

/** SUPPORT/ADMIN: quick-reply library. */
export async function GET() {
  const { error } = await requireRole(["SUPPORT", "ADMIN"]);
  if (error) return error;

  const responses = await prisma.cannedResponse.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
  return NextResponse.json({ responses });
}

const createSchema = z.object({
  title: z.string().min(2).max(120),
  category: z.string().min(1).max(60).default("Général"),
  body: z.string().min(2).max(8000),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole(["SUPPORT", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const response = await prisma.cannedResponse.create({ data: parsed.data });
  return NextResponse.json({ success: true, response }, { status: 201 });
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function PUT(req: NextRequest) {
  const { error } = await requireRole(["SUPPORT", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { id, ...data } = parsed.data;

  const response = await prisma.cannedResponse.update({ where: { id }, data });
  return NextResponse.json({ success: true, response });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireRole(["SUPPORT", "ADMIN"]);
  if (error) return error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Soft-delete so replies already sent keep their provenance.
  await prisma.cannedResponse.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
