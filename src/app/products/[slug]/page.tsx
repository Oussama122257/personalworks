import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { ProductDetail } from "@/components/storefront/product-detail";
import type { ProductDTO } from "@/hooks/useProducts";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      variants: true,
      store: { select: { id: true, name: true, slug: true, wilayaCode: true, status: true } },
      reviews: {
        include: { author: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!product || !product.isPublished || product.store.status !== "ACTIVE") {
    notFound();
  }

  return <ProductDetail product={serialize(product) as unknown as ProductDTO & { reviews: { id: string; rating: number; comment?: string | null; author?: { fullName: string } | null }[] }} />;
}
