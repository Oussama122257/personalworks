import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { serialize } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

/**
 * WILAYA_MANAGER/ADMIN: stores in scope.
 *  - default (?status=PENDING): awaiting approval (inactive, never approved)
 *  - ?status=ACTIVE: approved stores
 */
export async function GET(req: NextRequest) {
  const { session, error } = await requireRole(["WILAYA_MANAGER", "ADMIN"]);
  if (error) return error;

  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  const where: Prisma.StoreWhereInput =
    status === "ACTIVE" ? { isActive: true } : { isActive: false, approvedBy: null };

  if (session.user.role === "WILAYA_MANAGER" && session.user.wilayaCode) {
    where.wilayaCode = session.user.wilayaCode;
  }

  const stores = await prisma.store.findMany({
    where,
    include: {
      user: { select: { fullName: true, email: true, phone: true } },
      wilaya: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ stores: serialize(stores) });
}
