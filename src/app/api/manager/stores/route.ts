import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

/** WILAYA_MANAGER-only: stores in their wilaya (default: pending approval). */
export async function GET(req: NextRequest) {
  const { session, error } = await requireRole(["wilaya_manager", "admin"]);
  if (error) return error;

  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  const where: Prisma.StoreWhereInput = {
    status: status as Prisma.StoreWhereInput["status"],
  };
  if (session.user.role === "wilaya_manager" && session.user.wilayaCode) {
    where.wilayaCode = session.user.wilayaCode;
  }

  const stores = await prisma.store.findMany({
    where,
    include: {
      owner: { select: { fullName: true, email: true, phone: true } },
      wilaya: { select: { nameFr: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ stores: serialize(stores) });
}
