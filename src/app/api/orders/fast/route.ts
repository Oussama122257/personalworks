import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateReference, round2, serialize } from "@/lib/utils";
import { trackServerEvent } from "@/lib/pixel";
import { broadcast } from "@/lib/realtime";

const fastOrderSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(100),
  guestName: z.string().min(2),
  phone: z.string().min(8).max(15),
  wilayaCode: z.coerce.number().int().min(1).max(58),
  communeId: z.string().min(1),
  address: z.string().min(5),
});

const FALLBACK_SHIPPING_FEE = 500;

/** One-click COD checkout: creates Order + Shipment and decrements stock. */
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

  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    include: { product: { include: { store: true } } },
  });
  if (!variant || !variant.product.isPublished) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (variant.product.store.status !== "ACTIVE") {
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

  // Shipping fee from the store's configured provider rate for this wilaya.
  const provider =
    variant.product.store.shippingProvider === "CUSTOM"
      ? "YALIDINE"
      : variant.product.store.shippingProvider;
  const rate = await prisma.shippingRate.findFirst({
    where: {
      wilayaCode: input.wilayaCode,
      isActive: true,
      provider: provider === "ZEEM_DEFAULT" ? "YALIDINE" : provider,
    },
  });
  const shippingFee = rate ? Number(rate.homeDeliveryPrice) : FALLBACK_SHIPPING_FEE;

  const unitPrice = Number(variant.price);
  const totalAmount = round2(unitPrice * input.quantity + shippingFee);
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

      const order = await tx.order.create({
        data: {
          reference,
          buyerId: session?.user?.id ?? null,
          guestName: input.guestName,
          phone: input.phone,
          storeId: variant.product.storeId,
          variantId: variant.id,
          quantity: input.quantity,
          unitPrice,
          totalAmount,
          shippingFee,
          wilayaCode: input.wilayaCode,
          communeId: input.communeId,
          address: input.address,
          status: "PENDING",
          paymentMethod: "COD",
        },
      });

      await tx.shipment.create({
        data: {
          orderId: order.id,
          trackingNumber: generateReference("ZT"),
          provider: variant.product.store.shippingProvider,
          status: "PENDING_PICKUP",
          codAmount: totalAmount,
        },
      });

      return order;
    });

    // Post-commit side effects (never block or fail the order).
    await trackServerEvent("Purchase", {
      phone: input.phone,
      value: totalAmount,
      currency: "DZD",
      contentIds: [variant.product.id],
      eventId: order.id,
    });
    const payload = serialize({
      id: order.id,
      reference: order.reference,
      totalAmount,
      storeId: order.storeId,
      wilayaCode: order.wilayaCode,
      createdAt: order.createdAt,
    });
    await broadcast("orders", "order:new", payload);
    await broadcast(`store-${order.storeId}`, "order:new", payload);

    return NextResponse.json({ success: true, reference: order.reference });
  } catch (err) {
    if (err instanceof Error && err.message === "OUT_OF_STOCK") {
      return NextResponse.json({ error: "Insufficient stock" }, { status: 409 });
    }
    console.error("[orders/fast] failed", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
