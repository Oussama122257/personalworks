import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { round2 } from "@/lib/utils";

/** SELLER: 30-day KPIs, review score and critical-stock list. */
export async function GET() {
  const { session, error } = await requireRole(["SELLER"]);
  if (error) return error;

  const store = await prisma.store.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!store) {
    return NextResponse.json({ error: "No store found" }, { status: 404 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [lines, orderCount, reviews, variants] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        sellerId: store.id,
        order: { status: "DELIVERED", createdAt: { gte: thirtyDaysAgo } },
      },
      select: { price: true, quantity: true },
    }),
    prisma.shipment.count({
      where: { sellerId: store.id, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.review.aggregate({
      _avg: { rating: true },
      _count: { id: true },
      where: { product: { storeId: store.id }, status: "APPROVED" },
    }),
    prisma.productVariant.findMany({
      where: { product: { storeId: store.id } },
      select: {
        id: true,
        sku: true,
        stockQuantity: true,
        lowStockThreshold: true,
        attributes: true,
        product: { select: { name: true } },
      },
    }),
  ]);

  const revenue30d = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const critical = variants
    .filter((v) => v.stockQuantity <= v.lowStockThreshold)
    .map((v) => {
      const attrs = (v.attributes ?? {}) as { size?: string | null; color?: string | null };
      const label = [attrs.size, attrs.color].filter(Boolean).join(" / ");
      return {
        variantId: v.id,
        sku: v.sku,
        product: v.product.name,
        variant: label || v.sku,
        stock: v.stockQuantity,
        threshold: v.lowStockThreshold,
        outOfStock: v.stockQuantity === 0,
      };
    })
    .sort((a, b) => a.stock - b.stock);

  return NextResponse.json({
    revenue30d: round2(revenue30d),
    orders30d: orderCount,
    rating: reviews._avg.rating ? round2(reviews._avg.rating) : null,
    reviewCount: reviews._count.id,
    criticalStockCount: critical.length,
    criticalStock: critical,
  });
}
