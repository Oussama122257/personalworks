import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * ACCOUNTANT/ADMIN: bank transfer batch for pending seller payouts.
 * `?format=csv` streams a downloadable file grouped by seller; otherwise JSON.
 * Optional `from` / `to` ISO dates bound the range.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireRole(["ACCOUNTANT", "ADMIN"]);
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");

  const createdAt =
    from || to
      ? {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
        }
      : undefined;

  const payouts = await prisma.transaction.findMany({
    where: { type: "PAYOUT", status: "PENDING", ...(createdAt ? { createdAt } : {}) },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          rib: true,
          user: { select: { fullName: true, email: true, phone: true } },
        },
      },
      order: { select: { reference: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const perSeller = new Map<
    string,
    {
      sellerId: string;
      store: string;
      owner: string;
      rib: string | null;
      contact: string;
      total: number;
      orders: number;
      transactionIds: string[];
    }
  >();
  for (const p of payouts) {
    const entry = perSeller.get(p.sellerId) ?? {
      sellerId: p.sellerId,
      store: p.seller.name,
      owner: p.seller.user.fullName,
      rib: p.seller.rib,
      contact: p.seller.user.email ?? p.seller.user.phone,
      total: 0,
      orders: 0,
      transactionIds: [],
    };
    entry.total += p.amount;
    entry.orders += 1;
    entry.transactionIds.push(p.id);
    perSeller.set(p.sellerId, entry);
  }
  const rows = [...perSeller.values()];

  if (params.get("format") === "csv") {
    const csv = [
      "Seller Name,RIB,Total Amount,Orders,Contact",
      ...rows.map((r) =>
        [
          csvEscape(r.store),
          csvEscape(r.rib ?? "RIB MANQUANT"),
          r.total.toFixed(2),
          r.orders,
          csvEscape(r.contact),
        ].join(",")
      ),
    ].join("\n");

    const label = from || to ? `${from ?? "debut"}_${to ?? "aujourdhui"}` : "tous";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="zeem-virements-${label}.csv"`,
      },
    });
  }

  return NextResponse.json({
    range: { from, to },
    totalAmount: rows.reduce((s, r) => s + r.total, 0),
    sellers: rows,
    missingRib: rows.filter((r) => !r.rib).length,
  });
}

const markPaidSchema = z.object({
  sellerIds: z.array(z.string()).min(1).optional(),
  transactionIds: z.array(z.string()).min(1).optional(),
  receiptUrl: z.string().max(500).optional(),
  reference: z.string().max(120).optional(),
});

/** ACCOUNTANT/ADMIN: mark payouts settled after the bank receipt is uploaded. */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["ACCOUNTANT", "ADMIN"]);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = markPaidSchema.safeParse(body);
  if (!parsed.success || (!parsed.data.sellerIds && !parsed.data.transactionIds)) {
    return NextResponse.json(
      { error: "Provide sellerIds or transactionIds" },
      { status: 400 }
    );
  }

  const where = {
    type: "PAYOUT" as const,
    status: "PENDING" as const,
    ...(parsed.data.transactionIds
      ? { id: { in: parsed.data.transactionIds } }
      : { sellerId: { in: parsed.data.sellerIds! } }),
  };

  const targets = await prisma.transaction.findMany({ where, select: { id: true, amount: true } });
  if (targets.length === 0) {
    return NextResponse.json({ error: "Aucun virement en attente trouvé" }, { status: 404 });
  }

  await prisma.transaction.updateMany({
    where,
    data: {
      status: "PAID",
      paidAt: new Date(),
      description: parsed.data.reference
        ? `Réglé — virement ${parsed.data.reference}`
        : undefined,
    },
  });

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "STATUS_CHANGE",
    entity: "FINANCE",
    entityId: parsed.data.reference ?? "bulk-payout",
    newState: {
      settled: targets.length,
      total: targets.reduce((s, t) => s + t.amount, 0),
      receiptUrl: parsed.data.receiptUrl ?? null,
    },
    reason: "Virements marqués comme payés après réception bancaire",
    req,
  });

  return NextResponse.json({ success: true, settled: targets.length });
}
