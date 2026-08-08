import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

/**
 * Role-scoped shipment listing.
 *  - AGENT: shipments assigned to them + unassigned pickups in their wilaya
 *  - ADMIN/ACCOUNTANT: all shipments (optional ?status= filter)
 */
export async function GET(req: NextRequest) {
  const { session, error } = await requireRole(["AGENT", "ADMIN", "ACCOUNTANT"]);
  if (error) return error;

  const status = req.nextUrl.searchParams.get("status");
  const where: Prisma.ShipmentWhereInput = {};

  if (session.user.role === "AGENT") {
    where.OR = [
      { agentId: session.user.id },
      {
        agentId: null,
        status: "PENDING_PICKUP",
        ...(session.user.wilayaCode
          ? { order: { wilayaCode: session.user.wilayaCode } }
          : {}),
      },
    ];
  }
  if (status) where.status = status as Prisma.ShipmentWhereInput["status"];

  const shipments = await prisma.shipment.findMany({
    where,
    include: {
      order: {
        include: {
          wilaya: { select: { name: true } },
          items: {
            include: {
              variant: {
                select: {
                  sku: true,
                  attributes: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      seller: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ shipments: serialize(shipments) });
}
