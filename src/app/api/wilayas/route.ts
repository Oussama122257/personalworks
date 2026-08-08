import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public: all active wilayas with their communes (for address selectors). */
export async function GET() {
  const wilayas = await prisma.wilaya.findMany({
    where: { isActive: true },
    include: {
      communes: {
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { code: "asc" },
  });

  return NextResponse.json({ wilayas });
}
