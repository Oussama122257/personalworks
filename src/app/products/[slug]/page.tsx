import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { ProductDetail, type ProductWithReviews } from "@/components/storefront/product-detail";
import { assertNotInMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await assertNotInMaintenance();
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      variants: true,
      store: { select: { id: true, name: true, slug: true, wilayaCode: true, isActive: true } },
      reviews: {
        where: { status: "APPROVED" },
        include: { buyer: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!product || !product.isPublished || !product.store.isActive) {
    notFound();
  }

  return <ProductDetail product={serialize(product) as unknown as ProductWithReviews} />;
}
