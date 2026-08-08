import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";

/** Signed-in buyer: order history, loyalty balance and points ledger. */
export async function GET() {
  // Any authenticated role may read their own profile.
  const { session, error } = await requireRole([]);
  if (error) return error;

  const [profile, orders, loyalty, pointsLedger] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        wilayaCode: true,
        createdAt: true,
      },
    }),
    prisma.order.findMany({
      where: { buyerId: session.user.id },
      include: {
        items: {
          include: { variant: { select: { sku: true, product: { select: { name: true } } } } },
        },
        shipments: { select: { status: true, trackingNumber: true } },
        wilaya: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.loyaltyPoints.findUnique({ where: { buyerId: session.user.id } }),
    prisma.pointsTransaction.findMany({
      where: { buyerId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return NextResponse.json({
    profile: serialize(profile),
    orders: serialize(orders),
    loyalty: {
      balance: loyalty?.balance ?? 0,
      lifetimeEarned: loyalty?.lifetimeEarned ?? 0,
      lifetimeRedeemed: loyalty?.lifetimeRedeemed ?? 0,
    },
    pointsLedger: serialize(pointsLedger),
  });
}
