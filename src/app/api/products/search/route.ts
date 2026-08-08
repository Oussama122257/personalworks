import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

/**
 * Public product search.
 * Query params: q (text), wilayaCode (filter by store wilaya), category.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const wilayaCode = params.get("wilayaCode");
  const category = params.get("category")?.trim();

  const where: Prisma.ProductWhereInput = {
    isPublished: true,
    store: {
      status: "ACTIVE",
      ...(wilayaCode ? { wilayaCode: Number(wilayaCode) } : {}),
    },
    ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const products = await prisma.product.findMany({
    where,
    include: {
      variants: true,
      store: { select: { id: true, name: true, slug: true, wilayaCode: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return NextResponse.json({ products: serialize(products) });
}
