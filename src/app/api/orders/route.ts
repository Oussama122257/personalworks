import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

/**
 * Role-scoped order listing.
 *  - ADMIN/ACCOUNTANT: all orders
 *  - SELLER: orders containing their store's shipments
 *  - WILAYA_MANAGER: orders in their wilaya
 *  - BUYER: their own orders
 */
export async function GET(req: NextRequest) {
  const { session, error } = await requireRole([
    "ADMIN",
    "ACCOUNTANT",
    "SELLER",
    "WILAYA_MANAGER",
    "BUYER",
  ]);
  if (error) return error;

  const status = req.nextUrl.searchParams.get("status");
  const where: Prisma.OrderWhereInput = {};

  switch (session.user.role) {
    case "SELLER":
      where.shipments = { some: { seller: { userId: session.user.id } } };
      break;
    case "WILAYA_MANAGER":
      if (session.user.wilayaCode) where.wilayaCode = session.user.wilayaCode;
      break;
    case "BUYER":
      where.buyerId = session.user.id;
      break;
  }
  if (status) where.status = status as Prisma.OrderWhereInput["status"];

  const orders = await prisma.order.findMany({
    where,
    include: {
      buyer: { select: { fullName: true } },
      wilaya: { select: { name: true } },
      items: {
        include: {
          variant: {
            select: {
              sku: true,
              attributes: true,
              product: { select: { name: true, slug: true } },
            },
          },
        },
      },
      shipments: {
        select: {
          id: true,
          status: true,
          trackingNumber: true,
          codAmount: true,
          shippingFee: true,
          seller: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ orders: serialize(orders) });
}
