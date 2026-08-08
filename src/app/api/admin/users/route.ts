import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const staffSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8).max(20),
  password: z.string().min(8),
  role: z.enum([
    "WILAYA_MANAGER",
    "ACCOUNTANT",
    "AGENT",
    "ERP_MANAGER",
    "LOGISTICS_MANAGER",
    "SUPPORT",
  ]),
  wilayaCode: z.coerce.number().int().min(1).max(58).optional(),
});

/**
 * ADMIN-only: create staff accounts (wilaya managers, agents, accountants).
 * Needed because the seed only provisions the admin user.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = staffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (
    (data.role === "WILAYA_MANAGER" || data.role === "AGENT") &&
    !data.wilayaCode
  ) {
    return NextResponse.json(
      { error: "wilayaCode is required for managers and agents" },
      { status: 400 }
    );
  }

  const email = data.email.toLowerCase();
  const existing = await prisma.profile.findFirst({
    where: { OR: [{ email }, { phone: data.phone }] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email or phone already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const profile = await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.create({
      data: {
        userId: randomUUID(),
        email,
        phone: data.phone,
        passwordHash,
        fullName: data.fullName,
        role: data.role,
        wilayaCode: data.wilayaCode,
        isVerified: true,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        userRole: "ADMIN",
        action: "CREATE",
        entity: "USER",
        entityId: profile.id,
        newState: { role: data.role, wilayaCode: data.wilayaCode ?? null },
      },
    });
    return profile;
  });

  return NextResponse.json({ success: true, profileId: profile.id }, { status: 201 });
}
