import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { round2 } from "@/lib/utils";

const VAT_RATE = 0.19;
const VARIANCE_FLAG_THRESHOLD = 0.005; // 0.5%

/**
 * ACCOUNTANT/ADMIN treasury view.
 * Flags every delivered shipment whose collected amount differs from the COD
 * amount by more than 0.5%.
 */
export async function GET() {
  const { error } = await requireRole(["ACCOUNTANT", "ADMIN"]);
  if (error) return error;

  const [delivered, pendingPayouts, commissions, shipments] = await Promise.all([
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
    prisma.shipment.findMany({
      where: { status: "DELIVERED_COD_COLLECTED" },
      select: {
        id: true,
        codAmount: true,
        actualCollected: true,
        deliveredAt: true,
        order: { select: { reference: true } },
        seller: { select: { name: true } },
      },
      orderBy: { deliveredAt: "desc" },
      take: 500,
    }),
  ]);

  const collected = delivered._sum.actualCollected ?? 0;
  const expected = delivered._sum.codAmount ?? 0;

  const flagged = shipments
    .map((s) => {
      const actual = s.actualCollected ?? 0;
      const variance = actual - s.codAmount;
      const ratio = s.codAmount > 0 ? Math.abs(variance) / s.codAmount : 0;
      return {
        shipmentId: s.id,
        reference: s.order.reference,
        store: s.seller.name,
        expected: s.codAmount,
        collected: actual,
        variance: round2(variance),
        variancePct: round2(ratio * 100),
        deliveredAt: s.deliveredAt?.toISOString() ?? null,
        flagged: ratio > VARIANCE_FLAG_THRESHOLD,
      };
    })
    .filter((s) => s.flagged);

  const commissionMap = Object.fromEntries(
    commissions.map((c) => [c.type, c._sum.amount ?? 0])
  );
  const totalCommissions =
    (commissionMap.COMMISSION_OWNER ?? 0) + (commissionMap.COMMISSION_MANAGER ?? 0);

  return NextResponse.json({
    deliveredShipments: delivered._count.id,
    codExpected: round2(expected),
    codCollected: round2(collected),
    codVariance: round2(collected - expected),
    variancePct: expected > 0 ? round2(((collected - expected) / expected) * 100) : 0,
    totalCommissions: round2(totalCommissions),
    // Commission is the platform's revenue; VAT is computed on it.
    vatDue: round2(totalCommissions * VAT_RATE),
    vatRate: VAT_RATE * 100,
    pendingPayoutsTotal: round2(pendingPayouts._sum.amount ?? 0),
    pendingPayoutsCount: pendingPayouts._count.id,
    commissions: commissionMap,
    flaggedShipments: flagged,
  });
}
