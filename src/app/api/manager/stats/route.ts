import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

/** WILAYA_MANAGER-only: regional stats + 20% commission tracker. */
export async function GET() {
  const { session, error } = await requireRole(["wilaya_manager"]);
  if (error) return error;

  const wilayaCode = session.user.wilayaCode;
  if (!wilayaCode) {
    return NextResponse.json(
      { error: "No wilaya assigned to this manager" },
      { status: 400 }
    );
  }

  const [orders, stores, pendingStores, commission] = await Promise.all([
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      _count: { id: true },
      where: { wilayaCode },
    }),
    prisma.store.count({ where: { wilayaCode, status: "ACTIVE" } }),
    prisma.store.count({ where: { wilayaCode, status: "PENDING" } }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: "COMMISSION_MANAGER", profileId: session.user.id },
    }),
  ]);

  return NextResponse.json({
    wilayaCode,
    regionalGmv: Number(orders._sum.totalAmount ?? 0),
    regionalOrders: orders._count.id,
    activeStores: stores,
    pendingStores,
    commissionEarned: Number(commission._sum.amount ?? 0),
  });
}
