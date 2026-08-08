import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { round2 } from "@/lib/utils";

/** ACCOUNTANT/ADMIN: COD reconciliation — expected vs collected cash. */
export async function GET() {
  const { error } = await requireRole(["ACCOUNTANT", "ADMIN"]);
  if (error) return error;

  const [delivered, pendingPayouts, commissions] = await Promise.all([
    prisma.shipment.aggregate({
      _sum: { actualCollected: true, codAmount: true },
      _count: { id: true },
      where: { status: "DELIVERED_COD_COLLECTED" },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: { type: "PAYOUT", status: "PENDING" },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      _sum: { amount: true },
      where: { type: { in: ["COMMISSION_OWNER", "COMMISSION_MANAGER"] } },
    }),
  ]);

  const collected = delivered._sum.actualCollected ?? 0;
  const expectedTotal = delivered._sum.codAmount ?? 0;

  return NextResponse.json({
    deliveredShipments: delivered._count.id,
    codExpected: expectedTotal,
    codCollected: collected,
    codVariance: round2(collected - expectedTotal),
    pendingPayoutsTotal: pendingPayouts._sum.amount ?? 0,
    pendingPayoutsCount: pendingPayouts._count.id,
    commissions: Object.fromEntries(
      commissions.map((c) => [c.type, c._sum.amount ?? 0])
    ),
  });
}
