import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * ACCOUNTANT/ADMIN: bulk payout export.
 *  - ?format=csv → downloadable CSV of pending payouts grouped per store
 *  - default     → JSON listing
 */
export async function GET(req: NextRequest) {
  const { error } = await requireRole(["ACCOUNTANT", "ADMIN"]);
  if (error) return error;

  const payouts = await prisma.transaction.findMany({
    where: { type: "PAYOUT", status: "PENDING" },
    include: {
      seller: {
        select: {
          name: true,
          balance: true,
          user: { select: { fullName: true, email: true, phone: true } },
        },
      },
      order: { select: { reference: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (req.nextUrl.searchParams.get("format") === "csv") {
    // Group pending payouts per store for a bank transfer batch.
    const perStore = new Map<
      string,
      { store: string; owner: string; contact: string; total: number; orders: number }
    >();
    for (const p of payouts) {
      const entry = perStore.get(p.sellerId) ?? {
        store: p.seller.name,
        owner: p.seller.user.fullName,
        contact: p.seller.user.email ?? p.seller.user.phone,
        total: 0,
        orders: 0,
      };
      entry.total += p.amount;
      entry.orders += 1;
      perStore.set(p.sellerId, entry);
    }

    const rows = [
      "store,owner,contact,orders,total_dzd",
      ...[...perStore.values()].map((e) =>
        [csvEscape(e.store), csvEscape(e.owner), csvEscape(e.contact), e.orders, e.total.toFixed(2)].join(",")
      ),
    ];

    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="zeem-payouts-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: p.amount,
      store: p.seller.name,
      owner: p.seller.user.fullName,
      orderReference: p.order?.reference ?? "—",
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
