import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { COURIERS, probeCourier } from "@/lib/couriers";

/** LOGISTICS/ADMIN: last known courier API status. */
export async function GET() {
  const { error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
  if (error) return error;

  const stored = await prisma.courierHealth.findMany();
  const byCourier = new Map(stored.map((c) => [c.courierType, c]));

  return NextResponse.json({
    couriers: COURIERS.map((c) => {
      const row = byCourier.get(c);
      return {
        courierType: c,
        isOnline: row?.isOnline ?? null,
        lastCheckedAt: row?.lastCheckedAt?.toISOString() ?? null,
        lastError: row?.lastError ?? null,
        latencyMs: row?.latencyMs ?? null,
        neverChecked: !row,
      };
    }),
  });
}

/**
 * Health check. Intended to run on a schedule (Vercel Cron, GitHub Action or
 * any external scheduler hitting this endpoint every ~5 minutes) — Next.js has
 * no built-in cron, so nothing runs it automatically.
 *
 * Accepts either an authenticated LOGISTICS/ADMIN session or a
 * `x-cron-secret` header matching CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  const viaCron = Boolean(cronSecret && headerSecret && headerSecret === cronSecret);

  if (!viaCron) {
    const { error } = await requireRole(["LOGISTICS_MANAGER", "ADMIN"]);
    if (error) return error;
  }

  const results = [];
  for (const courier of COURIERS) {
    const probe = await probeCourier(courier);
    await prisma.courierHealth.upsert({
      where: { courierType: courier },
      update: {
        isOnline: probe.online,
        lastCheckedAt: new Date(),
        lastError: probe.error,
        latencyMs: probe.latencyMs,
      },
      create: {
        courierType: courier,
        isOnline: probe.online,
        lastCheckedAt: new Date(),
        lastError: probe.error,
        latencyMs: probe.latencyMs,
      },
    });
    // A courier that is down stops being offered for new shipments.
    await prisma.shippingRate.updateMany({
      where: { courierType: courier },
      data: { isActive: probe.online || !probe.configured },
    });
    results.push(probe);
  }

  return NextResponse.json({ success: true, results });
}
