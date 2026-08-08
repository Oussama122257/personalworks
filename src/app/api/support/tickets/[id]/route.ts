import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { serialize } from "@/lib/utils";

/** SUPPORT/ADMIN: full ticket with its message thread and order context. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["SUPPORT", "ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      buyer: { select: { fullName: true, email: true, phone: true } },
      assignedTo: { select: { fullName: true } },
      order: {
        include: {
          items: {
            include: { variant: { select: { sku: true, product: { select: { name: true } } } } },
          },
          shipments: {
            select: { status: true, trackingNumber: true, codAmount: true, attemptCount: true },
          },
          wilaya: { select: { name: true } },
        },
      },
      messages: {
        include: { author: { select: { fullName: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  return NextResponse.json({ ticket: serialize(ticket) });
}

const updateSchema = z.object({
  status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assignToMe: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(["SUPPORT", "ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const before = await prisma.supportTicket.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const resolved = parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED";
  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.assignToMe ? { assignedToId: session.user.id } : {}),
      ...(resolved ? { resolvedAt: new Date() } : {}),
    },
  });

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "STATUS_CHANGE",
    entity: "SETTINGS",
    entityId: id,
    oldState: { status: before.status, priority: before.priority },
    newState: { status: ticket.status, priority: ticket.priority },
    req,
  });

  return NextResponse.json({ success: true, ticket: serialize(ticket) });
}
