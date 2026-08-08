import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

/** ACCOUNTANT/ADMIN: active sellers, for the invoice generation list. */
export async function GET() {
  const { error } = await requireRole(["ACCOUNTANT", "ADMIN"]);
  if (error) return error;

  const stores = await prisma.store.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      rib: true,
      balance: true,
      wilaya: { select: { name: true } },
      user: { select: { fullName: true } },
      _count: { select: { shipments: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    sellers: stores.map((s) => ({
      id: s.id,
      name: s.name,
      owner: s.user.fullName,
      wilaya: s.wilaya.name,
      rib: s.rib,
      balance: s.balance,
      shipments: s._count.shipments,
    })),
  });
}
