import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/api-auth";
import { generateReference, serialize } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

/** SUPPORT/ADMIN: ticket queue. */
export async function GET(req: NextRequest) {
  const { error } = await requireRole(["SUPPORT", "ADMIN"]);
  if (error) return error;

  const status = req.nextUrl.searchParams.get("status");
  const where: Prisma.SupportTicketWhereInput = status
    ? { status: status as Prisma.SupportTicketWhereInput["status"] }
    : {};

  const tickets = await prisma.supportTicket.findMany({
    where,
    include: {
      buyer: { select: { fullName: true, email: true, phone: true } },
      order: { select: { reference: true, totalAmount: true, status: true } },
      assignedTo: { select: { fullName: true } },
      _count: { select: { messages: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 100,
  });

  return NextResponse.json({ tickets: serialize(tickets) });
}

const createSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(3).max(4000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  orderReference: z.string().max(40).optional(),
  contactName: z.string().max(120).optional(),
  contactPhone: z.string().max(20).optional(),
});

/**
 * Creates a ticket. Open to buyers (including guests via the contact form) —
 * linking an order reference gives the support agent the full context.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const session = await auth();

  if (!session?.user && !data.contactPhone) {
    return NextResponse.json(
      { error: "Un numéro de contact est requis pour les demandes non connectées" },
      { status: 400 }
    );
  }

  let orderId: string | null = null;
  let shipmentId: string | null = null;
  if (data.orderReference) {
    const order = await prisma.order.findUnique({
      where: { reference: data.orderReference.toUpperCase() },
      select: { id: true, shipments: { select: { id: true }, take: 1 } },
    });
    if (!order) {
      return NextResponse.json({ error: "Référence de commande introuvable" }, { status: 404 });
    }
    orderId = order.id;
    shipmentId = order.shipments[0]?.id ?? null;
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      reference: generateReference("ZS"),
      subject: data.subject,
      priority: data.priority,
      status: "OPEN",
      buyerId: session?.user?.id ?? null,
      contactName: data.contactName ?? session?.user?.name ?? null,
      contactPhone: data.contactPhone ?? null,
      orderId,
      shipmentId,
      messages: {
        create: [
          {
            authorId: session?.user?.id ?? null,
            authorType: "BUYER",
            body: data.body,
          },
        ],
      },
    },
    include: { messages: true },
  });

  return NextResponse.json(
    { success: true, ticket: serialize(ticket) },
    { status: 201 }
  );
}
