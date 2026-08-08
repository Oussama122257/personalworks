import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit, clientIp } from "@/lib/audit";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

/**
 * Account security: password change, TOTP two-factor, login history and
 * "sign out everywhere".
 *
 * Sessions use the JWT strategy, so there is no server-side session list to
 * enumerate or revoke individually. Instead `Profile.sessionsValidFrom` is
 * bumped and the JWT callback rejects any token issued before it — which
 * genuinely invalidates every existing session, including the current one.
 * The UI therefore offers "sign out everywhere" rather than a per-device kill
 * switch, and shows login history from the LoginEvent table.
 */

export async function GET() {
  const { session, error } = await requireRole([]);
  if (error) return error;

  const [profile, events] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true, sessionsValidFrom: true, passwordHash: true },
    }),
    prisma.loginEvent.findMany({
      where: { profileId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    twoFactorEnabled: profile?.twoFactorEnabled ?? false,
    hasPassword: Boolean(profile?.passwordHash),
    sessionsValidFrom: profile?.sessionsValidFrom?.toISOString() ?? null,
    loginHistory: events.map((e) => ({
      id: e.id,
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      success: e.success,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}

const passwordSchema = z.object({
  action: z.literal("change_password"),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

const twoFactorStartSchema = z.object({ action: z.literal("2fa_start") });

const twoFactorConfirmSchema = z.object({
  action: z.literal("2fa_confirm"),
  token: z.string().length(6),
});

const twoFactorDisableSchema = z.object({
  action: z.literal("2fa_disable"),
  password: z.string().min(1),
});

const signOutAllSchema = z.object({ action: z.literal("sign_out_everywhere") });

const schema = z.discriminatedUnion("action", [
  passwordSchema,
  twoFactorStartSchema,
  twoFactorConfirmSchema,
  twoFactorDisableSchema,
  signOutAllSchema,
]);

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

  const profile = await prisma.profile.findUnique({ where: { id: session.user.id } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  switch (parsed.data.action) {
    case "change_password": {
      if (!profile.passwordHash) {
        return NextResponse.json(
          { error: "Ce compte utilise Google — aucun mot de passe à modifier" },
          { status: 400 }
        );
      }
      const ok = await bcrypt.compare(parsed.data.currentPassword, profile.passwordHash);
      if (!ok) {
        return NextResponse.json(
          { error: "Mot de passe actuel incorrect" },
          { status: 400 }
        );
      }
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          passwordHash: await bcrypt.hash(parsed.data.newPassword, 10),
          // Changing the password invalidates sessions everywhere.
          sessionsValidFrom: new Date(),
        },
      });
      await recordAudit({
        actor: { id: profile.id, role: session.user.role },
        action: "UPDATE",
        entity: "USER",
        entityId: profile.id,
        newState: { passwordChanged: true },
        req,
      });
      return NextResponse.json({ success: true, signedOutEverywhere: true });
    }

    case "2fa_start": {
      const secret = generateSecret();
      const otpauth = generateURI({
        secret,
        label: profile.email ?? profile.phone,
        issuer: "Zeem Marketplace",
      });
      // Stored encrypted and only activated once a valid code is confirmed.
      await prisma.profile.update({
        where: { id: profile.id },
        data: { twoFactorSecret: encryptSecret(secret) },
      });
      return NextResponse.json({
        success: true,
        secret,
        qrCodeDataUrl: await QRCode.toDataURL(otpauth),
      });
    }

    case "2fa_confirm": {
      const secret = decryptSecret(profile.twoFactorSecret);
      if (!secret) {
        return NextResponse.json(
          { error: "Commencez par générer un QR code" },
          { status: 400 }
        );
      }
      if (!verifySync({ token: parsed.data.token, secret }).valid) {
        return NextResponse.json({ error: "Code invalide" }, { status: 400 });
      }
      await prisma.profile.update({
        where: { id: profile.id },
        data: { twoFactorEnabled: true },
      });
      await recordAudit({
        actor: { id: profile.id, role: session.user.role },
        action: "UPDATE",
        entity: "USER",
        entityId: profile.id,
        newState: { twoFactorEnabled: true },
        req,
      });
      return NextResponse.json({ success: true });
    }

    case "2fa_disable": {
      if (
        profile.passwordHash &&
        !(await bcrypt.compare(parsed.data.password, profile.passwordHash))
      ) {
        return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 400 });
      }
      await prisma.profile.update({
        where: { id: profile.id },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      });
      await recordAudit({
        actor: { id: profile.id, role: session.user.role },
        action: "UPDATE",
        entity: "USER",
        entityId: profile.id,
        newState: { twoFactorEnabled: false },
        req,
      });
      return NextResponse.json({ success: true });
    }

    case "sign_out_everywhere": {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { sessionsValidFrom: new Date() },
      });
      await prisma.loginEvent.create({
        data: {
          profileId: profile.id,
          ipAddress: clientIp(req),
          userAgent: req.headers.get("user-agent"),
          success: true,
        },
      });
      return NextResponse.json({ success: true });
    }
  }
}
