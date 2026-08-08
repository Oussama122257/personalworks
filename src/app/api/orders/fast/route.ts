import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateReference, round2, serialize } from "@/lib/utils";
import { trackServerEvent } from "@/lib/pixel";
import { broadcast } from "@/lib/realtime";
import { pickAgentForWilaya } from "@/lib/assignment";
import { getSettings } from "@/lib/settings";

const fastOrderSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(100),
  guestName: z.string().min(2),
  phone: z.string().min(8).max(15),
  wilayaCode: z.coerce.number().int().min(1).max(58),
  communeId: z.coerce.number().int(),
  address: z.string().min(5),
});

const FALLBACK_SHIPPING_FEE = 500;

/** One-click COD checkout: creates Order + OrderItem + Shipment, decrements stock. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = fastOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const session = await auth();

  // Guest checkout can be switched off platform-wide.
  const [features, shippingDefaults, general] = await Promise.all([
    getSettings("features"),
    getSettings("shipping"),
    getSettings("general"),
  ]);
  if (!features.guestCheckout && !session?.user) {
    return NextResponse.json(
      { error: "La commande sans compte est désactivée — connectez-vous pour continuer." },
      { status: 403 }
    );
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    include: { product: { include: { store: true } } },
  });
  if (!variant || !variant.product.isPublished) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  const store = variant.product.store;
  if (!store.isActive) {
    return NextResponse.json({ error: "This store is not active" }, { status: 400 });
  }
  if (variant.stockQuantity < input.quantity) {
    return NextResponse.json(
      { error: "Insufficient stock", available: variant.stockQuantity },
      { status: 409 }
    );
  }

  const commune = await prisma.commune.findUnique({ where: { id: input.communeId } });
  if (!commune || commune.wilayaCode !== input.wilayaCode) {
    return NextResponse.json(
      { error: "Commune does not belong to the selected wilaya" },
      { status: 400 }
    );
  }

  // Shipping fee from the courier rate matrix for the destination wilaya.
  const courier =
    store.deliveryProviderType === "ZEEM_DEFAULT" || store.deliveryProviderType === "CUSTOM"
      ? "YALIDINE"
      : store.deliveryProviderType;
  const rate = await prisma.shippingRate.findFirst({
    where: { wilayaCode: input.wilayaCode, courierType: courier, isActive: true },
  });
  // Regional surcharge set by the wilaya manager, then the free-shipping
  // threshold (store override first, platform default otherwise).
  const regional = await prisma.wilayaSettings.findUnique({
    where: { wilayaCode: input.wilayaCode },
  });
  const baseShipping =
    (rate ? rate.basePrice : FALLBACK_SHIPPING_FEE) + (regional?.shippingSurcharge ?? 0);

  const itemsTotal = round2(variant.price * input.quantity);
  const freeThreshold = store.freeShippingThreshold ?? shippingDefaults.freeShippingThreshold;
  const shippingFee = freeThreshold > 0 && itemsTotal >= freeThreshold ? 0 : baseShipping;
  const totalAmount = round2(itemsTotal + shippingFee);
  const platformFee = round2(totalAmount * (store.commissionRate / 100));
  const reference = generateReference("ZM");

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Conditional decrement guards against overselling under concurrency.
      const updated = await tx.productVariant.updateMany({
        where: { id: variant.id, stockQuantity: { gte: input.quantity } },
        data: { stockQuantity: { decrement: input.quantity } },
      });
      if (updated.count === 0) {
        throw new Error("OUT_OF_STOCK");
      }

      return tx.order.create({
        data: {
          reference,
          buyerId: session?.user?.id ?? null,
          guestName: input.guestName,
          guestPhone: input.phone,
          totalAmount,
          platformFee,
          ownerShare: round2(platformFee * (general.ownerShare / 100)),
          managerShare: round2(platformFee * (general.managerShare / 100)),
          status: "PENDING",
          checkoutType: "FAST",
          wilayaCode: input.wilayaCode,
          address: `${input.address}, ${commune.name}`,
          items: {
            create: [
              {
                variantId: variant.id,
                quantity: input.quantity,
                price: variant.price,
                sellerId: store.id,
              },
            ],
          },
          shipments: {
            create: [
              {
                sellerId: store.id,
                deliveryCompany: courier,
                trackingNumber: generateReference("ZT"),
                shippingFee,
                codAmount: totalAmount,
                status: "PENDING_PICKUP",
              },
            ],
          },
        },
      });
    });

    // Route the parcel to the least-loaded agent covering this wilaya.
    try {
      const agentId = await pickAgentForWilaya(input.wilayaCode);
      if (agentId) {
        await prisma.shipment.updateMany({
          where: { orderId: order.id, agentId: null },
          data: { agentId },
        });
      }
    } catch (err) {
      console.error("[orders/fast] agent assignment failed", err);
    }

    // Post-commit side effects (never block or fail the order).
    await trackServerEvent("Purchase", {
      phone: input.phone,
      value: totalAmount,
      currency: "DZD",
      contentIds: [variant.product.id],
      // Reference is the dedup key shared with the browser-side pixel.
      eventId: order.reference,
    });
    const payload = serialize({
      id: order.id,
      reference: order.reference,
      totalAmount,
      storeId: store.id,
      wilayaCode: order.wilayaCode,
      createdAt: order.createdAt,
    });
    await broadcast("orders", "order:new", payload);
    await broadcast(`store-${store.id}`, "order:new", payload);

    return NextResponse.json({ success: true, reference: order.reference });
  } catch (err) {
    if (err instanceof Error && err.message === "OUT_OF_STOCK") {
      return NextResponse.json({ error: "Insufficient stock" }, { status: 409 });
    }
    console.error("[orders/fast] failed", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
