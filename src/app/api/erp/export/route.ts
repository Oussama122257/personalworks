import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { getSettings } from "@/lib/settings";

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

  const { exportFields, exportFilenamePattern, csvDelimiter } = await getSettings("erp");

  const variants = await prisma.productVariant.findMany({
    include: {
      product: { select: { name: true, category: true, description: true, isPublished: true, store: { select: { slug: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Only the columns the ERP manager selected are emitted, in a fixed order.
  const lines = variants.map((v) => {
    const attrs = (v.attributes ?? {}) as { size?: string | null; color?: string | null };
    const cells: Record<string, unknown> = {
      store_slug: v.product.store.slug,
      product_name: v.product.name,
      category: v.product.category,
      description: v.product.description,
      sku: v.sku,
      size: attrs.size,
      color: attrs.color,
      price: v.price.toFixed(2),
      stock: v.stockQuantity,
      low_stock_threshold: v.lowStockThreshold,
      published: v.product.isPublished ? "true" : "false",
    };
    return exportFields.map((f) => csvEscape(cells[f])).join(csvDelimiter);
  });

  const filename = exportFilenamePattern.replace(
    "{YYYYMMDD}",
    new Date().toISOString().slice(0, 10).replace(/-/g, "")
  );

  return new NextResponse([exportFields.join(csvDelimiter), ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
