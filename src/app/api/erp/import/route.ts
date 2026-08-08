import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";

/**
 * ERP bulk catalogue import.
 *
 * Expected columns (header row required):
 *   store_slug, product_name, category, description, sku, size, color,
 *   price, stock, low_stock_threshold, published
 *
 * Products are matched by slug, variants by SKU: existing rows are updated,
 * missing rows created. The whole file runs inside one Prisma transaction, so
 * a single bad row rolls the entire import back.
 */

interface Row {
  store_slug?: string;
  product_name?: string;
  category?: string;
  description?: string;
  sku?: string;
  size?: string;
  color?: string;
  price?: string;
  stock?: string;
  low_stock_threshold?: string;
  published?: string;
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["ERP_MANAGER", "ADMIN"]);
  if (error) return error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Fichier CSV manquant" }, { status: 400 });
  }

  const text = await file.text();
  const parsed = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      {
        error: "CSV illisible",
        details: parsed.errors.slice(0, 5).map((e) => `Ligne ${e.row}: ${e.message}`),
      },
      { status: 400 }
    );
  }
  const rows = parsed.data;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Le fichier ne contient aucune ligne" }, { status: 400 });
  }
  if (rows.length > 5000) {
    return NextResponse.json(
      { error: "Import limité à 5000 lignes par fichier" },
      { status: 413 }
    );
  }

  const summary = {
    rows: rows.length,
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
  };

  try {
    await prisma.$transaction(
      async (tx) => {
        // Cache store lookups so a 5000-row file does not issue 5000 queries.
        const storeCache = new Map<string, string>();

        for (const [index, row] of rows.entries()) {
          const line = index + 2; // +1 header, +1 for 1-based numbering
          const storeSlug = row.store_slug?.trim();
          const productName = row.product_name?.trim();
          const sku = row.sku?.trim();
          const price = Number(row.price);
          const stock = Number(row.stock ?? 0);

          if (!storeSlug) throw new Error(`Ligne ${line} : store_slug manquant`);
          if (!productName) throw new Error(`Ligne ${line} : product_name manquant`);
          if (!sku) throw new Error(`Ligne ${line} : sku manquant`);
          if (!Number.isFinite(price) || price <= 0) {
            throw new Error(`Ligne ${line} : prix invalide (« ${row.price} »)`);
          }
          if (!Number.isInteger(stock) || stock < 0) {
            throw new Error(`Ligne ${line} : stock invalide (« ${row.stock} »)`);
          }

          let storeId = storeCache.get(storeSlug);
          if (!storeId) {
            const store = await tx.store.findUnique({
              where: { slug: storeSlug },
              select: { id: true },
            });
            if (!store) {
              throw new Error(`Ligne ${line} : boutique « ${storeSlug} » introuvable`);
            }
            storeId = store.id;
            storeCache.set(storeSlug, storeId);
          }

          const productSlug = slugify(`${storeSlug}-${productName}`);
          const existingProduct = await tx.product.findUnique({
            where: { slug: productSlug },
            select: { id: true },
          });

          let productId: string;
          if (existingProduct) {
            await tx.product.update({
              where: { id: existingProduct.id },
              data: {
                name: productName,
                category: row.category?.trim() || undefined,
                description: row.description?.trim() || undefined,
                ...(row.published !== undefined && row.published !== ""
                  ? { isPublished: /^(1|true|oui|yes)$/i.test(row.published.trim()) }
                  : {}),
              },
            });
            productId = existingProduct.id;
            summary.productsUpdated++;
          } else {
            const created = await tx.product.create({
              data: {
                storeId,
                name: productName,
                slug: productSlug,
                category: row.category?.trim() || null,
                description: row.description?.trim() || null,
                isPublished: row.published
                  ? /^(1|true|oui|yes)$/i.test(row.published.trim())
                  : true,
              },
              select: { id: true },
            });
            productId = created.id;
            summary.productsCreated++;
          }

          const existingVariant = await tx.productVariant.findUnique({
            where: { sku },
            select: { id: true, productId: true },
          });

          const attributes = {
            size: row.size?.trim() || null,
            color: row.color?.trim() || null,
          };
          const threshold = Number(row.low_stock_threshold);

          if (existingVariant) {
            if (existingVariant.productId !== productId) {
              throw new Error(
                `Ligne ${line} : le SKU « ${sku} » appartient déjà à un autre produit`
              );
            }
            await tx.productVariant.update({
              where: { id: existingVariant.id },
              data: {
                price,
                stockQuantity: stock,
                attributes,
                ...(Number.isInteger(threshold) ? { lowStockThreshold: threshold } : {}),
              },
            });
            summary.variantsUpdated++;
          } else {
            await tx.productVariant.create({
              data: {
                productId,
                sku,
                price,
                stockQuantity: stock,
                attributes,
                ...(Number.isInteger(threshold) ? { lowStockThreshold: threshold } : {}),
              },
            });
            summary.variantsCreated++;
          }
        }
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import échoué";
    // The transaction already rolled back — nothing was written.
    return NextResponse.json(
      { error: `Import annulé, aucune donnée modifiée. ${message}` },
      { status: 400 }
    );
  }

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "CREATE",
    entity: "PRODUCT",
    entityId: `bulk-import-${Date.now()}`,
    newState: summary,
    reason: `Import CSV de ${summary.rows} ligne(s)`,
    req,
  });

  return NextResponse.json({ success: true, ...summary });
}
