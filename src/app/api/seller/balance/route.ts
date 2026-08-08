import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { round2 } from "@/lib/utils";

/** SELLER: store balance plus pending/paid payout breakdown. */
export async function GET() {
  const { session, error } = await requireRole(["SELLER"]);
  if (error) return error;

  const store = await prisma.store.findUnique({
    where: { userId: session.user.id },
    select: { id: true, balance: true, commissionRate: true, rib: true },
  });
  if (!store) {
    return NextResponse.json({ error: "No store found" }, { status: 404 });
  }

  const [pending, paid, commissions, recent] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: { sellerId: store.id, type: "PAYOUT", status: "PENDING" },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { sellerId: store.id, type: "PAYOUT", status: "PAID" },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        sellerId: store.id,
        type: { in: ["COMMISSION_OWNER", "COMMISSION_MANAGER"] },
      },
    }),
    prisma.transaction.findMany({
      where: { sellerId: store.id },
      include: { order: { select: { reference: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    balance: round2(store.balance),
    rib: store.rib,
    commissionRate: store.commissionRate,
    pendingPayout: round2(pending._sum.amount ?? 0),
    pendingCount: pending._count.id,
    paidPayout: round2(paid._sum.amount ?? 0),
    commissionsWithheld: round2(commissions._sum.amount ?? 0),
    transactions: recent.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      amount: round2(t.amount),
      reference: t.order?.reference ?? "—",
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}
