import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { round2 } from "@/lib/utils";

const VAT_RATE = 0.19;

/**
 * ACCOUNTANT/ADMIN: invoice data for one seller over a period.
 * The PDF is rendered client-side by @react-pdf/renderer; this route supplies
 * the computed lines, commission base and 19% VAT.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const { error } = await requireRole(["ACCOUNTANT", "ADMIN"]);
  if (error) return error;

  const { storeId } = await params;
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      user: { select: { fullName: true, email: true, phone: true } },
      wilaya: { select: { name: true } },
    },
  });
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const deliveredAt =
    from || to
      ? {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
        }
      : undefined;

  const shipments = await prisma.shipment.findMany({
    where: {
      sellerId: storeId,
      status: "DELIVERED_COD_COLLECTED",
      ...(deliveredAt ? { deliveredAt } : {}),
    },
    include: { order: { select: { reference: true, createdAt: true } } },
    orderBy: { deliveredAt: "asc" },
  });

  const commissionRows = await prisma.transaction.findMany({
    where: {
      sellerId: storeId,
      type: { in: ["COMMISSION_OWNER", "COMMISSION_MANAGER"] },
      ...(deliveredAt ? { createdAt: deliveredAt } : {}),
    },
    select: { amount: true },
  });

  const lines = shipments.map((s) => ({
    reference: s.order.reference,
    deliveredAt: s.deliveredAt?.toISOString() ?? null,
    codAmount: round2(s.codAmount),
    collected: round2(s.actualCollected ?? 0),
    shippingFee: round2(s.shippingFee),
  }));

  const grossCollected = lines.reduce((s, l) => s + l.collected, 0);
  const shippingTotal = lines.reduce((s, l) => s + l.shippingFee, 0);
  const commissionHT = commissionRows.reduce((s, t) => s + t.amount, 0);
  const vat = commissionHT * VAT_RATE;

  return NextResponse.json({
    store: {
      id: store.id,
      name: store.name,
      owner: store.user.fullName,
      contact: store.user.email ?? store.user.phone,
      wilaya: store.wilaya.name,
      rib: store.rib,
      commissionRate: store.commissionRate,
    },
    period: { from, to },
    lines,
    totals: {
      deliveries: lines.length,
      grossCollected: round2(grossCollected),
      shippingTotal: round2(shippingTotal),
      commissionHT: round2(commissionHT),
      vatRate: VAT_RATE * 100,
      vat: round2(vat),
      commissionTTC: round2(commissionHT + vat),
      // Matches the PAYOUT transactions written by completeDelivery:
      // collected − commission − shipping. VAT on the commission is borne by
      // the platform, so it is not deducted a second time here.
      netToSeller: round2(grossCollected - commissionHT - shippingTotal),
    },
  });
}
