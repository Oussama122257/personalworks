import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

/**
 * WILAYA_MANAGER: regional stats, commune heatmap and commission tracker.
 * Every query is scoped by the manager's own wilayaCode.
 */
export async function GET() {
  const { session, error } = await requireRole(["WILAYA_MANAGER"]);
  if (error) return error;

  const wilayaCode = session.user.wilayaCode;
  if (!wilayaCode) {
    return NextResponse.json(
      { error: "No wilaya assigned to this manager" },
      { status: 400 }
    );
  }

  const [orders, activeStores, pendingStores, commissionPaid, commissionPending, regionOrders, communes] =
    await Promise.all([
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        _count: { id: true },
        where: { wilayaCode },
      }),
      prisma.store.count({ where: { wilayaCode, isActive: true } }),
      prisma.store.count({
        where: { wilayaCode, isActive: false, approvedBy: null },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: "COMMISSION_MANAGER",
          status: "PAID",
          seller: { wilayaCode },
        },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: "COMMISSION_MANAGER",
          status: "PENDING",
          seller: { wilayaCode },
        },
      }),
      // Commune density is derived from the order address, which stores
      // "street, commune" — matched against the wilaya's commune list below.
      prisma.order.findMany({
        where: { wilayaCode },
        select: { address: true, totalAmount: true },
      }),
      prisma.commune.findMany({
        where: { wilayaCode },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const heatmap = communes
    .map((c) => {
      const matches = regionOrders.filter((o) =>
        o.address.toLowerCase().includes(c.name.toLowerCase())
      );
      return {
        communeId: c.id,
        name: c.name,
        orders: matches.length,
        revenue: matches.reduce((s, o) => s + o.totalAmount, 0),
      };
    })
    .sort((a, b) => b.orders - a.orders);

  const paid = commissionPaid._sum.amount ?? 0;
  const pending = commissionPending._sum.amount ?? 0;

  return NextResponse.json({
    wilayaCode,
    regionalGmv: orders._sum.totalAmount ?? 0,
    regionalOrders: orders._count.id,
    activeStores,
    pendingStores,
    commissionPaid: paid,
    commissionPending: pending,
    commissionTotal: paid + pending,
    heatmap,
  });
}
