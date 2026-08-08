import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";

/**
 * WILAYA_MANAGER: request payout of accrued commission.
 * Flags every PAID manager-commission row in their wilaya as claimed by
 * writing an audit entry the accountant picks up; the accountant marks the
 * transactions settled from their own dashboard.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["WILAYA_MANAGER"]);
  if (error) return error;

  const wilayaCode = session.user.wilayaCode;
  if (!wilayaCode) {
    return NextResponse.json({ error: "No wilaya assigned" }, { status: 400 });
  }

  const claimable = await prisma.transaction.aggregate({
    _sum: { amount: true },
    _count: { id: true },
    where: { type: "COMMISSION_MANAGER", status: "PAID", seller: { wilayaCode } },
  });

  const amount = claimable._sum.amount ?? 0;
  if (amount <= 0) {
    return NextResponse.json(
      { error: "Aucune commission disponible au paiement" },
      { status: 400 }
    );
  }

  await recordAudit({
    actor: { id: session.user.id, role: session.user.role },
    action: "CREATE",
    entity: "FINANCE",
    entityId: `payout-request-w${wilayaCode}`,
    newState: {
      wilayaCode,
      requestedAmount: amount,
      transactionCount: claimable._count.id,
    },
    reason: "Demande de paiement de commission manager",
    req,
  });

  return NextResponse.json({ success: true, requestedAmount: amount });
}
