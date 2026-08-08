import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8).max(15),
  password: z.string().min(8),
  role: z.enum(["BUYER", "SELLER"]).default("BUYER"),
  // Seller-only fields
  storeName: z.string().min(2).optional(),
  wilayaCode: z.coerce.number().int().min(1).max(58).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (data.role === "SELLER" && (!data.storeName || !data.wilayaCode)) {
    return NextResponse.json(
      { error: "storeName and wilayaCode are required for sellers" },
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
      },
    });

    if (data.role === "SELLER") {
      const baseSlug = slugify(data.storeName!) || "store";
      const slug = `${baseSlug}-${profile.id.slice(-6)}`;
      // Stores normally await wilaya-manager approval, unless that manager
      // has switched auto-approval on for their wilaya.
      const regional = await tx.wilayaSettings.findUnique({
        where: { wilayaCode: data.wilayaCode! },
      });
      const autoApprove = regional?.autoApproveSellers ?? false;
      await tx.store.create({
        data: {
          name: data.storeName!,
          slug,
          userId: profile.id,
          wilayaCode: data.wilayaCode!,
          isActive: autoApprove,
          approvedBy: autoApprove ? "AUTO_APPROVED" : null,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: profile.id,
        userRole: data.role,
        action: "CREATE",
        entity: "USER",
        entityId: profile.id,
        newState: { role: data.role },
      },
    });

    return profile;
  });

  return NextResponse.json({ success: true, profileId: profile.id }, { status: 201 });
}
