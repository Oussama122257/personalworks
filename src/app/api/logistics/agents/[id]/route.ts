import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { serialize } from "@/lib/utils";

const schema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().min(8).max(20).optional(),
  email: z.string().email().nullable().optional(),
  wilayaCode: z.coerce.number().int().min(1).max(58).nullable().optional(),
  isOnline: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/** LOGISTICS/ADMIN: edit an agent's details, zone or availability. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const agent = await prisma.profile.findFirst({ where: { id, role: "AGENT" } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { isActive, email, phone, ...rest } = parsed.data;

  if (phone) {
    const clash = await prisma.profile.findFirst({
      where: { phone, NOT: { id } },
    });
    if (clash) {
      return NextResponse.json(
        { error: "Ce numéro est déjà utilisé par un autre compte" },
        { status: 409 }
      );
    }
  }
  if (email) {
    const clash = await prisma.profile.findFirst({
      where: { email: email.toLowerCase(), NOT: { id } },
    });
    if (clash) {
      return NextResponse.json(
        { error: "Cet email est déjà utilisé par un autre compte" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.profile.update({
    where: { id },
    data: {
      ...rest,
      ...(phone ? { phone } : {}),
      ...(email !== undefined ? { email: email ? email.toLowerCase() : null } : {}),
      // Deactivating an agent revokes their sessions immediately.
      ...(isActive === false ? { sessionsValidFrom: new Date(), isOnline: false } : {}),
    },
  });

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "UPDATE",
    entity: "USER",
    entityId: id,
    oldState: { wilayaCode: agent.wilayaCode, isOnline: agent.isOnline },
    newState: { wilayaCode: updated.wilayaCode, isOnline: updated.isOnline },
    req,
  });

  return NextResponse.json({ success: true, agent: serialize(updated) });
}
