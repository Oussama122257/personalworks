import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateReference, round2, serialize } from "@/lib/utils";
import { trackServerEvent } from "@/lib/pixel";
import { broadcast } from "@/lib/realtime";
import { pickAgentForWilaya } from "@/lib/assignment";

/**
 * Multi-store cart checkout.
 *
 * Items may belong to different stores: one parent Order is created with one
 * Shipment per store, each carrying its own shippingFee and COD amount.
 * Loyalty points can be redeemed against the total (100 points = 100 DZD).
 */

const POINT_VALUE_DZD = 1;
const FALLBACK_SHIPPING_FEE = 500;

const cartSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(100),
      })
    )
    .min(1)
    .max(50),
  guestName: z.string().min(2),
  phone: z.string().min(8).max(20),
  wilayaCode: z.coerce.number().int().min(1).max(58),
  communeId: z.coerce.number().int(),
  address: z.string().min(5),
  pointsToRedeem: z.coerce.number().int().min(0).default(0),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = cartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const session = await auth();

  const commune = await prisma.commune.findUnique({ where: { id: input.communeId } });
  if (!commune || commune.wilayaCode !== input.wilayaCode) {
    return NextResponse.json(
      { error: "Commune does not belong to the selected wilaya" },
      { status: 400 }
    );
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: input.items.map((i) => i.variantId) } },
    include: { product: { include: { store: true } } },
  });
  if (variants.length !== input.items.length) {
    return NextResponse.json({ error: "Some products no longer exist" }, { status: 404 });
  }

  const byVariant = new Map(variants.map((v) => [v.id, v]));
  for (const item of input.items) {
    const v = byVariant.get(item.variantId)!;
    if (!v.product.isPublished || !v.product.store.isActive) {
      return NextResponse.json(
        { error: `« ${v.product.name} » n'est plus disponible` },
        { status: 400 }
      );
    }
    if (v.stockQuantity < item.quantity) {
      return NextResponse.json(
        { error: `Stock insuffisant pour « ${v.product.name} »`, available: v.stockQuantity },
        { status: 409 }
      );
    }
  }

  // Group the lines per store — one shipment each.
  const groups = new Map<string, { storeId: string; items: typeof input.items; goods: number }>();
  for (const item of input.items) {
    const v = byVariant.get(item.variantId)!;
    const storeId = v.product.storeId;
    const group = groups.get(storeId) ?? { storeId, items: [], goods: 0 };
    group.items.push(item);
    group.goods += v.price * item.quantity;
    groups.set(storeId, group);
  }

  // Shipping is charged per store (each parcel ships separately).
  const rates = await prisma.shippingRate.findMany({
    where: { wilayaCode: input.wilayaCode, isActive: true },
  });
  const rateFor = (courier: string) =>
    rates.find((r) => r.courierType === courier)?.basePrice ?? FALLBACK_SHIPPING_FEE;

  let goodsTotal = 0;
  let shippingTotal = 0;
  const shipmentPlans = [...groups.values()].map((g) => {
    const store = byVariant.get(g.items[0].variantId)!.product.store;
    const courier =
      store.deliveryProviderType === "ZEEM_DEFAULT" || store.deliveryProviderType === "CUSTOM"
        ? "YALIDINE"
        : store.deliveryProviderType;
    const shippingFee = rateFor(courier);
    goodsTotal += g.goods;
    shippingTotal += shippingFee;
    return { ...g, store, courier, shippingFee };
  });

  // Loyalty redemption — capped by balance and by the goods subtotal.
  let pointsRedeemed = 0;
  let discountAmount = 0;
  if (session?.user?.id && input.pointsToRedeem > 0) {
    const loyalty = await prisma.loyaltyPoints.findUnique({
      where: { buyerId: session.user.id },
    });
    const available = loyalty?.balance ?? 0;
    pointsRedeemed = Math.min(input.pointsToRedeem, available, Math.floor(goodsTotal / POINT_VALUE_DZD));
    discountAmount = round2(pointsRedeemed * POINT_VALUE_DZD);
  }

  const totalAmount = round2(goodsTotal + shippingTotal - discountAmount);
  const reference = generateReference("ZM");

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Conditional decrements prevent overselling under concurrency.
      for (const item of input.items) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (updated.count === 0) throw new Error("OUT_OF_STOCK");
      }

      const created = await tx.order.create({
        data: {
          reference,
          buyerId: session?.user?.id ?? null,
          guestName: input.guestName,
          guestPhone: input.phone,
          totalAmount,
          pointsRedeemed,
          discountAmount,
          status: "PENDING",
          checkoutType: "CART",
          wilayaCode: input.wilayaCode,
          address: `${input.address}, ${commune.name}`,
          items: {
            create: input.items.map((i) => {
              const v = byVariant.get(i.variantId)!;
              return {
                variantId: i.variantId,
                quantity: i.quantity,
                price: v.price,
                sellerId: v.product.storeId,
              };
            }),
          },
          shipments: {
            create: shipmentPlans.map((p) => {
              const codShare = round2(
                p.goods + p.shippingFee - discountAmount * (p.goods / goodsTotal)
              );
              return {
                sellerId: p.storeId,
                deliveryCompany: p.courier,
                trackingNumber: generateReference("ZT"),
                shippingFee: p.shippingFee,
                codAmount: codShare,
                status: "PENDING_PICKUP" as const,
              };
            }),
          },
        },
      });

      if (pointsRedeemed > 0 && session?.user?.id) {
        await tx.loyaltyPoints.update({
          where: { buyerId: session.user.id },
          data: {
            balance: { decrement: pointsRedeemed },
            lifetimeRedeemed: { increment: pointsRedeemed },
          },
        });
        await tx.pointsTransaction.create({
          data: {
            buyerId: session.user.id,
            orderId: created.id,
            amount: -pointsRedeemed,
            type: "REDEEMED_DISCOUNT",
            description: `Réduction de ${discountAmount} DZD sur la commande ${reference}`,
          },
        });
      }

      return created;
    });

    // Route each parcel to the least-loaded agent covering this wilaya.
    try {
      const agentId = await pickAgentForWilaya(input.wilayaCode);
      if (agentId) {
        await prisma.shipment.updateMany({
          where: { orderId: order.id, agentId: null },
          data: { agentId },
        });
      }
    } catch (err) {
      console.error("[orders/cart] agent assignment failed", err);
    }

    await trackServerEvent("Purchase", {
      phone: input.phone,
      value: totalAmount,
      currency: "DZD",
      eventId: order.reference,
    });
    const payload = serialize({
      id: order.id,
      reference: order.reference,
      totalAmount,
      wilayaCode: order.wilayaCode,
      createdAt: order.createdAt,
    });
    await broadcast("orders", "order:new", payload);
    for (const p of shipmentPlans) {
      await broadcast(`store-${p.storeId}`, "order:new", payload);
    }

    return NextResponse.json({
      success: true,
      reference: order.reference,
      shipments: shipmentPlans.length,
      discountAmount,
      totalAmount,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "OUT_OF_STOCK") {
      return NextResponse.json({ error: "Stock insuffisant" }, { status: 409 });
    }
    console.error("[orders/cart] failed", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
