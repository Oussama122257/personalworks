import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

/**
 * Role-scoped order listing.
 *  - admin/accountant: all orders
 *  - seller: orders of their stores
 *  - wilaya_manager: orders in their wilaya
 *  - buyer: their own orders
 */
export async function GET(req: NextRequest) {
  const { session, error } = await requireRole([
    "admin",
    "accountant",
    "seller",
    "wilaya_manager",
    "buyer",
  ]);
  if (error) return error;

  const status = req.nextUrl.searchParams.get("status");
  const where: Prisma.OrderWhereInput = {};

  switch (session.user.role) {
    case "seller":
      where.store = { ownerId: session.user.id };
      break;
    case "wilaya_manager":
      if (session.user.wilayaCode) where.wilayaCode = session.user.wilayaCode;
      break;
    case "buyer":
      where.buyerId = session.user.id;
      break;
  }
  if (status) where.status = status as Prisma.OrderWhereInput["status"];

  const orders = await prisma.order.findMany({
    where,
    include: {
      store: { select: { id: true, name: true } },
      variant: { include: { product: { select: { name: true, slug: true } } } },
      wilaya: { select: { nameFr: true } },
      commune: { select: { name: true } },
      shipment: { select: { id: true, status: true, trackingNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ orders: serialize(orders) });
}
