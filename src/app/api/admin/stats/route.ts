import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { round2 } from "@/lib/utils";

/**
 * ADMIN pulse stats.
 *  - GMV counts DELIVERED orders only (money actually collected)
 *  - Growth = (thisMonth - lastMonth) / lastMonth * 100
 *  - COD refusal rate = failed/returned shipments / all terminal shipments
 *  - `series` powers the 30-day Revenue vs Orders chart
 */
export async function GET() {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    deliveredTotals,
    allOrders,
    activeSellers,
    failedShipments,
    terminalShipments,
    thisMonth,
    lastMonth,
    recentOrders,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      _count: { id: true },
      where: { status: "DELIVERED" },
    }),
    prisma.order.count(),
    prisma.store.count({ where: { isActive: true } }),
    prisma.shipment.count({ where: { status: { in: ["FAILED", "RETURNED"] } } }),
    prisma.shipment.count({
      where: { status: { in: ["FAILED", "RETURNED", "DELIVERED_COD_COLLECTED"] } },
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      _count: { id: true },
      where: { status: "DELIVERED", createdAt: { gte: startOfThisMonth } },
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      _count: { id: true },
      where: {
        status: "DELIVERED",
        createdAt: { gte: startOfLastMonth, lt: startOfThisMonth },
      },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, totalAmount: true, status: true },
    }),
  ]);

  const gmvThisMonth = thisMonth._sum.totalAmount ?? 0;
  const gmvLastMonth = lastMonth._sum.totalAmount ?? 0;
  const growthPct =
    gmvLastMonth > 0
      ? round2(((gmvThisMonth - gmvLastMonth) / gmvLastMonth) * 100)
      : gmvThisMonth > 0
        ? 100
        : 0;

  // Dense 30-day series so the chart has no gaps on quiet days.
  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    buckets.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  }
  for (const o of recentOrders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    if (o.status === "DELIVERED") bucket.revenue += o.totalAmount;
  }

  return NextResponse.json({
    gmv: deliveredTotals._sum.totalAmount ?? 0,
    gmvThisMonth,
    totalSales: allOrders,
    deliveredOrders: deliveredTotals._count.id,
    activeSellers,
    codRefusalRate:
      terminalShipments > 0 ? round2((failedShipments / terminalShipments) * 100) : 0,
    trends: {
      gmvThisMonth,
      gmvLastMonth,
      ordersThisMonth: thisMonth._count.id,
      ordersLastMonth: lastMonth._count.id,
      growthPct,
    },
    series: [...buckets.entries()].map(([date, v]) => ({
      date,
      revenue: round2(v.revenue),
      orders: v.orders,
    })),
  });
}
