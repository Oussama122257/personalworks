import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { notify } from "@/lib/notifications";
import { serialize } from "@/lib/utils";

/** Any authenticated user: personal information. */
export async function GET() {
  const { session, error } = await requireRole([]);
  if (error) return error;

  const profile = await prisma.profile.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      avatarUrl: true,
      role: true,
      isVerified: true,
      twoFactorEnabled: true,
      isOnline: true,
      workingHoursStart: true,
      workingHoursEnd: true,
      wilayaCode: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ profile: serialize(profile) });
}

const schema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email().nullable().optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
  // Agent-only availability fields
  isOnline: z.boolean().optional(),
  workingHoursStart: z.string().max(5).nullable().optional(),
  workingHoursEnd: z.string().max(5).nullable().optional(),
});

/**
 * Updates personal information. The phone number is deliberately excluded —
 * it is the login identifier, so it changes only through the OTP flow in
 * /api/profile/phone.
 */
export async function PUT(req: NextRequest) {
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

  const { email, dateOfBirth, ...rest } = parsed.data;

  if (email) {
    const clash = await prisma.profile.findFirst({
      where: { email: email.toLowerCase(), NOT: { id: session.user.id } },
    });
    if (clash) {
      return NextResponse.json(
        { error: "Cette adresse email est déjà utilisée" },
        { status: 409 }
      );
    }
  }

  const profile = await prisma.profile.update({
    where: { id: session.user.id },
    data: {
      ...rest,
      ...(email !== undefined ? { email: email ? email.toLowerCase() : null } : {}),
      ...(dateOfBirth !== undefined
        ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }
        : {}),
    },
  });

  return NextResponse.json({ success: true, profile: serialize(profile) });
}

const phoneSchema = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().length(6).optional(),
});

/**
 * Phone change, OTP-verified.
 *  - without `code`: generates a 6-digit code valid 10 minutes and sends it
 *  - with `code`: verifies and applies the change
 *
 * With no SMS provider configured the code is written to the server log by
 * src/lib/notifications.ts rather than silently discarded.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole([]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = phoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { phone, code } = parsed.data;

  const clash = await prisma.profile.findFirst({
    where: { phone, NOT: { id: session.user.id } },
  });
  if (clash) {
    return NextResponse.json(
      { error: "Ce numéro est déjà associé à un autre compte" },
      { status: 409 }
    );
  }

  if (!code) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.profile.update({
      where: { id: session.user.id },
      data: {
        phoneOtpCode: otp,
        phoneOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    await notify({
      phone,
      subject: "Code de vérification Zeem",
      body: `Votre code de vérification Zeem est : ${otp}. Il expire dans 10 minutes.`,
      smsToo: true,
    });
    return NextResponse.json({ success: true, step: "code_sent" });
  }

  const profile = await prisma.profile.findUnique({ where: { id: session.user.id } });
  if (
    !profile?.phoneOtpCode ||
    !profile.phoneOtpExpiresAt ||
    profile.phoneOtpExpiresAt < new Date()
  ) {
    return NextResponse.json(
      { error: "Code expiré — demandez-en un nouveau" },
      { status: 400 }
    );
  }
  if (profile.phoneOtpCode !== code) {
    return NextResponse.json({ error: "Code incorrect" }, { status: 400 });
  }

  await prisma.profile.update({
    where: { id: session.user.id },
    data: { phone, phoneOtpCode: null, phoneOtpExpiresAt: null, isVerified: true },
  });

  return NextResponse.json({ success: true, step: "verified" });
}
