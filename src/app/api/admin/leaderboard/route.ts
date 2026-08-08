import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { round2 } from "@/lib/utils";

/** ADMIN: top 10 stores by revenue and top 10 products by quantity sold. */
export async function GET() {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;

  // Revenue per seller: OrderItem carries the denormalised sellerId, so a
  // multi-store order is attributed to each seller for its own lines.
  const [topSellersRaw, topVariantsRaw] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["sellerId"],
      _sum: { quantity: true },
      where: { order: { status: "DELIVERED" } },
      orderBy: { _sum: { quantity: "desc" } },
      take: 50,
    }),
    prisma.orderItem.groupBy({
      by: ["variantId"],
      _sum: { quantity: true },
      where: { order: { status: "DELIVERED" } },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
  ]);

  // Revenue needs price × quantity, which groupBy cannot express — pull the
  // delivered lines for these sellers and fold them.
  const sellerIds = topSellersRaw.map((s) => s.sellerId);
  const lines = await prisma.orderItem.findMany({
    where: { sellerId: { in: sellerIds }, order: { status: "DELIVERED" } },
    select: { sellerId: true, price: true, quantity: true, orderId: true },
  });

  const bySeller = new Map<string, { revenue: number; units: number; orders: Set<string> }>();
  for (const l of lines) {
    const entry =
      bySeller.get(l.sellerId) ?? { revenue: 0, units: 0, orders: new Set<string>() };
    entry.revenue += l.price * l.quantity;
    entry.units += l.quantity;
    entry.orders.add(l.orderId);
    bySeller.set(l.sellerId, entry);
  }

  const stores = await prisma.store.findMany({
    where: { id: { in: sellerIds } },
    select: { id: true, name: true, slug: true, wilaya: { select: { name: true } } },
  });
  const storeById = new Map(stores.map((s) => [s.id, s]));

  const topStores = [...bySeller.entries()]
    .map(([storeId, v]) => ({
      storeId,
      name: storeById.get(storeId)?.name ?? "—",
      wilaya: storeById.get(storeId)?.wilaya?.name ?? "—",
      revenue: round2(v.revenue),
      units: v.units,
      orders: v.orders.size,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: topVariantsRaw.map((v) => v.variantId) } },
    select: {
      id: true,
      sku: true,
      attributes: true,
      product: { select: { name: true, slug: true, store: { select: { name: true } } } },
    },
  });
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const topProducts = topVariantsRaw.map((row) => {
    const v = variantById.get(row.variantId);
    return {
      variantId: row.variantId,
      sku: v?.sku ?? "—",
      name: v?.product.name ?? "—",
      slug: v?.product.slug ?? "",
      store: v?.product.store.name ?? "—",
      quantitySold: row._sum.quantity ?? 0,
    };
  });

  return NextResponse.json({ topStores, topProducts });
}
