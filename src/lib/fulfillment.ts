import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/utils";
import { broadcast } from "@/lib/realtime";

export class FulfillmentError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
  }
}

const OWNER_SHARE = 0.8;
const MANAGER_SHARE = 0.2;
const DZD_PER_POINT = 100;

/**
 * Marks a shipment as delivered with COD collected and settles the money:
 *  - totalCommission = totalAmount * store.commissionRate / 100
 *  - platform owner takes 80%, the wilaya manager takes 20%
 *  - the seller is credited totalAmount - totalCommission - shippingFee
 *  - the buyer (if registered) earns 1 loyalty point per 100 DZD spent
 * Everything runs in one database transaction; an audit log row records it.
 */
export async function processDelivery(params: {
  shipmentId: string;
  agentId: string;
  collectedAmount: number;
  lat?: number;
  lng?: number;
}) {
  const { shipmentId, agentId, collectedAmount, lat, lng } = params;

  const result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { include: { store: true } } },
    });
    if (!shipment) throw new FulfillmentError("Shipment not found", 404);
    if (shipment.status === "DELIVERED_COD_COLLECTED") {
      throw new FulfillmentError("Shipment already delivered", 409);
    }
    if (shipment.agentId && shipment.agentId !== agentId) {
      throw new FulfillmentError("Shipment is assigned to another agent", 403);
    }

    const order = shipment.order;
    const store = order.store;
    const totalAmount = Number(order.totalAmount);
    const shippingFee = Number(order.shippingFee);
    const commissionRate = Number(store.commissionRate);

    const totalCommission = round2((totalAmount * commissionRate) / 100);
    const ownerShare = round2(totalCommission * OWNER_SHARE);
    const managerShare = round2(totalCommission - ownerShare);
    const sellerNet = round2(totalAmount - totalCommission - shippingFee);

    const now = new Date();
    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "DELIVERED_COD_COLLECTED",
        agentId: shipment.agentId ?? agentId,
        collectedAmount,
        deliveredAt: now,
        lastLat: lat,
        lastLng: lng,
      },
    });

    if (lat !== undefined && lng !== undefined) {
      await tx.deliveryLocationUpdate.create({
        data: { shipmentId: shipment.id, lat, lng, note: "Delivered (COD collected)" },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED" },
    });

    // The 20% manager cut is credited to the wilaya manager of the store's
    // wilaya when one exists; the transaction row is written either way.
    const manager = await tx.profile.findFirst({
      where: { role: "wilaya_manager", wilayaCode: store.wilayaCode, isActive: true },
    });

    await tx.transaction.createMany({
      data: [
        {
          type: "COMMISSION_OWNER",
          status: "COMPLETED",
          amount: ownerShare,
          orderId: order.id,
          storeId: store.id,
          description: `Platform commission (80%) — order ${order.reference}`,
        },
        {
          type: "COMMISSION_MANAGER",
          status: "COMPLETED",
          amount: managerShare,
          orderId: order.id,
          storeId: store.id,
          profileId: manager?.id ?? null,
          description: `Wilaya manager commission (20%) — order ${order.reference}`,
        },
        {
          type: "PAYOUT",
          status: "PENDING",
          amount: sellerNet,
          orderId: order.id,
          storeId: store.id,
          profileId: store.ownerId,
          description: `Seller payout — order ${order.reference}`,
        },
      ],
    });

    await tx.store.update({
      where: { id: store.id },
      data: { balance: { increment: sellerNet } },
    });

    // Loyalty: 1 point per 100 DZD spent, registered buyers only.
    let pointsEarned = 0;
    if (order.buyerId) {
      pointsEarned = Math.floor(totalAmount / DZD_PER_POINT);
      if (pointsEarned > 0) {
        await tx.loyaltyPoints.upsert({
          where: { profileId: order.buyerId },
          update: {
            balance: { increment: pointsEarned },
            lifetimeEarned: { increment: pointsEarned },
          },
          create: {
            profileId: order.buyerId,
            balance: pointsEarned,
            lifetimeEarned: pointsEarned,
          },
        });
        await tx.pointsTransaction.create({
          data: {
            profileId: order.buyerId,
            orderId: order.id,
            type: "EARN",
            points: pointsEarned,
            description: `Points earned on order ${order.reference}`,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: agentId,
        action: "SHIPMENT_DELIVERED_COD_COLLECTED",
        entityType: "Shipment",
        entityId: shipment.id,
        before: { status: shipment.status },
        after: {
          status: "DELIVERED_COD_COLLECTED",
          collectedAmount,
          totalCommission,
          ownerShare,
          managerShare,
          sellerNet,
          pointsEarned,
        },
      },
    });

    return {
      orderId: order.id,
      reference: order.reference,
      storeId: store.id,
      totalCommission,
      ownerShare,
      managerShare,
      sellerNet,
      pointsEarned,
    };
  });

  await broadcast(`store-${result.storeId}`, "shipment:update", {
    shipmentId,
    status: "DELIVERED_COD_COLLECTED",
    reference: result.reference,
  });
  await broadcast(`agent-${agentId}`, "shipment:update", {
    shipmentId,
    status: "DELIVERED_COD_COLLECTED",
  });

  return result;
}

/** Marks a delivery attempt as failed with a reason. */
export async function processDeliveryFailure(params: {
  shipmentId: string;
  agentId: string;
  reason: string;
}) {
  const { shipmentId, agentId, reason } = params;
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { order: true },
  });
  if (!shipment) throw new FulfillmentError("Shipment not found", 404);
  if (shipment.status === "DELIVERED_COD_COLLECTED") {
    throw new FulfillmentError("Shipment already delivered", 409);
  }
  if (shipment.agentId && shipment.agentId !== agentId) {
    throw new FulfillmentError("Shipment is assigned to another agent", 403);
  }

  await prisma.$transaction([
    prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: "FAILED_DELIVERY",
        agentId: shipment.agentId ?? agentId,
        failureReason: reason,
      },
    }),
    prisma.order.update({
      where: { id: shipment.orderId },
      data: { status: "FAILED" },
    }),
    prisma.auditLog.create({
      data: {
        actorId: agentId,
        action: "SHIPMENT_DELIVERY_FAILED",
        entityType: "Shipment",
        entityId: shipmentId,
        before: { status: shipment.status },
        after: { status: "FAILED_DELIVERY", reason },
      },
    }),
  ]);

  await broadcast(`agent-${agentId}`, "shipment:update", {
    shipmentId,
    status: "FAILED_DELIVERY",
  });
}
