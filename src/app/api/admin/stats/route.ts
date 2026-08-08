import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { round2 } from "@/lib/utils";

/** ADMIN-only platform statistics computed with Prisma aggregate queries. */
export async function GET() {
  const { error } = await requireRole(["admin"]);
  if (error) return error;

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [totals, sellers, refunds, topStoresRaw, thisMonth, lastMonth] =
    await Promise.all([
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.store.count({ where: { status: "ACTIVE" } }),
      prisma.order.count({ where: { status: "REFUNDED" } }),
      prisma.order.groupBy({
        by: ["storeId"],
        _sum: { totalAmount: true },
        _count: { id: true },
        orderBy: { _sum: { totalAmount: "desc" } },
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

  const storeIds = topStoresRaw.map((s) => s.storeId);
  const stores = await prisma.store.findMany({
    where: { id: { in: storeIds } },
    select: { id: true, name: true, slug: true, wilaya: { select: { nameFr: true } } },
  });
  const storeById = new Map(stores.map((s) => [s.id, s]));

  const gmv = Number(totals._sum.totalAmount ?? 0);
  const totalOrders = totals._count.id;
  const gmvThisMonth = Number(thisMonth._sum.totalAmount ?? 0);
  const gmvLastMonth = Number(lastMonth._sum.totalAmount ?? 0);

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
    refundRate: totalOrders > 0 ? round2((refunds / totalOrders) * 100) : 0,
    topStores: topStoresRaw.map((row) => ({
      storeId: row.storeId,
      name: storeById.get(row.storeId)?.name ?? "—",
      wilaya: storeById.get(row.storeId)?.wilaya?.nameFr ?? "—",
      revenue: Number(row._sum.totalAmount ?? 0),
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
