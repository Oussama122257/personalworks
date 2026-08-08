import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

/** ADMIN: order density per wilaya for the geo map. */
export async function GET() {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const [grouped, wilayas] = await Promise.all([
    prisma.order.groupBy({
      by: ["wilayaCode"],
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.wilaya.findMany({
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const byCode = new Map(
    grouped
      .filter((g) => g.wilayaCode !== null)
      .map((g) => [g.wilayaCode as number, g])
  );

  const density = wilayas.map((w) => ({
    code: w.code,
    name: w.name,
    orders: byCode.get(w.code)?._count.id ?? 0,
    revenue: byCode.get(w.code)?._sum.totalAmount ?? 0,
  }));

  const maxOrders = density.reduce((m, d) => Math.max(m, d.orders), 0);

  return NextResponse.json({ density, maxOrders });
}
