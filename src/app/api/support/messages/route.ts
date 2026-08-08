import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notify, templates } from "@/lib/notifications";
import { serialize } from "@/lib/utils";

const schema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1).max(4000),
});

/**
 * Posts a message to a ticket.
 *  - from a support agent: the buyer is emailed and the ticket moves to PENDING
 *  - from the buyer: the ticket is reopened (status OPEN) for the agent
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: parsed.data.ticketId },
    include: { buyer: { select: { email: true, phone: true } } },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const isStaff = ["SUPPORT", "ADMIN"].includes(session.user.role);
  // Buyers may only post on their own tickets.
  if (!isStaff && ticket.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: session.user.id,
        authorType: isStaff ? "AGENT" : "BUYER",
        body: parsed.data.body,
      },
      include: { author: { select: { fullName: true, role: true } } },
    });

    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: isStaff ? "PENDING" : "OPEN",
        ...(isStaff && !ticket.assignedToId ? { assignedToId: session.user.id } : {}),
      },
    });

    return created;
  });

  // Notify the buyer when support replies.
  if (isStaff) {
    const tpl = templates.ticketReply(ticket.reference, parsed.data.body);
    await notify({
      email: ticket.buyer?.email ?? null,
      phone: ticket.buyer?.phone ?? ticket.contactPhone,
      subject: tpl.subject,
      body: tpl.body,
    });
  }

  return NextResponse.json({ success: true, message: serialize(message) }, { status: 201 });
}
