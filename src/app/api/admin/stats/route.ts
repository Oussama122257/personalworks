import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { round2 } from "@/lib/utils";

/** ADMIN-only platform statistics computed with Prisma aggregate queries. */
export async function GET() {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [totals, sellers, returns, topSellersRaw, thisMonth, lastMonth] =
    await Promise.all([
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.store.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: { in: ["RETURNED", "CANCELLED"] } } }),
      // Revenue per store via shipments (orders can span several sellers).
      prisma.shipment.groupBy({
        by: ["sellerId"],
        _sum: { codAmount: true },
        _count: { id: true },
        orderBy: { _sum: { codAmount: "desc" } },
        take: 5,
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        _count: { id: true },
        where: { createdAt: { gte: startOfThisMonth } },
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        _count: { id: true },
        where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } },
      }),
    ]);

  const sellerIds = topSellersRaw.map((s) => s.sellerId);
  const stores = await prisma.store.findMany({
    where: { id: { in: sellerIds } },
    select: { id: true, name: true, slug: true, wilaya: { select: { name: true } } },
  });
  const storeById = new Map(stores.map((s) => [s.id, s]));

  const gmv = totals._sum.totalAmount ?? 0;
  const totalOrders = totals._count.id;
  const gmvThisMonth = thisMonth._sum.totalAmount ?? 0;
  const gmvLastMonth = lastMonth._sum.totalAmount ?? 0;

  const growthPct =
    gmvLastMonth > 0
      ? round2(((gmvThisMonth - gmvLastMonth) / gmvLastMonth) * 100)
      : gmvThisMonth > 0
        ? 100
        : 0;

  return NextResponse.json({
    gmv,
    totalOrders,
    activeSellers: sellers,
    refundRate: totalOrders > 0 ? round2((returns / totalOrders) * 100) : 0,
    topStores: topSellersRaw.map((row) => ({
      storeId: row.sellerId,
      name: storeById.get(row.sellerId)?.name ?? "—",
      wilaya: storeById.get(row.sellerId)?.wilaya?.name ?? "—",
      revenue: row._sum.codAmount ?? 0,
      orders: row._count.id,
    })),
    trends: {
      gmvThisMonth,
      gmvLastMonth,
      ordersThisMonth: thisMonth._count.id,
      ordersLastMonth: lastMonth._count.id,
      growthPct,
    },
  });
}
