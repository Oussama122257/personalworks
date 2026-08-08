import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * ERP: export the whole catalogue as CSV.
 * The column layout matches what POST /api/erp/import expects, so an export
 * can be edited and re-imported round-trip.
 */
export async function GET() {
  const { error } = await requireRole(["ERP_MANAGER", "ADMIN"]);
  if (error) return error;

  const variants = await prisma.productVariant.findMany({
    include: {
      product: { select: { name: true, category: true, description: true, isPublished: true, store: { select: { slug: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const header =
    "store_slug,product_name,category,description,sku,size,color,price,stock,low_stock_threshold,published";
  const lines = variants.map((v) => {
    const attrs = (v.attributes ?? {}) as { size?: string | null; color?: string | null };
    return [
      csvEscape(v.product.store.slug),
      csvEscape(v.product.name),
      csvEscape(v.product.category),
      csvEscape(v.product.description),
      csvEscape(v.sku),
      csvEscape(attrs.size),
      csvEscape(attrs.color),
      v.price.toFixed(2),
      v.stockQuantity,
      v.lowStockThreshold,
      v.product.isPublished ? "true" : "false",
    ].join(",");
  });

  return new NextResponse([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zeem-catalogue-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
