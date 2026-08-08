import prisma from './prisma'
import { trackServerEvent } from './pixel'
import { broadcast } from './realtime'
import { notify, templates } from './notifications'

export class FulfillmentError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message)
  }
}

/**
 * Critical COD money logic: marks a shipment delivered, splits the commission
 * (80% owner / 20% wilaya manager of the store's commissionRate), credits the
 * seller balance and awards loyalty points (1 pt per 100 DZD).
 */
export async function completeDelivery({
  shipmentId,
  collectedAmount,
  agentId,
  lat,
  lng,
}: {
  shipmentId: string
  collectedAmount: number
  agentId: string
  lat?: number
  lng?: number
}) {
  // 1. Fetch shipment with relations
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      order: true,
      seller: {
        include: {
          user: true, // To check manager
        },
      },
    },
  })

  if (!shipment) throw new FulfillmentError('Shipment not found', 404)
  if (shipment.status === 'DELIVERED_COD_COLLECTED')
    throw new FulfillmentError('Already delivered', 409)
  if (shipment.agentId && shipment.agentId !== agentId)
    throw new FulfillmentError('Shipment is assigned to another agent', 403)

  const { order, seller } = shipment

  // 2. Calculate Commission
  const totalCommission = order.totalAmount * (seller.commissionRate / 100) // e.g., 10%
  const ownerShare = totalCommission * 0.8 // 8%
  const managerShare = totalCommission * 0.2 // 2%
  const shippingFee = shipment.shippingFee || 0
  const payoutAmount = order.totalAmount - totalCommission - shippingFee

  // 3-5. Update shipment + order + money movements atomically.
  const updatedShipment = await prisma.$transaction(async (tx) => {
    const updatedShipment = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'DELIVERED_COD_COLLECTED',
        actualCollected: collectedAmount,
        deliveredAt: new Date(),
        agentId: agentId,
      },
    })

    // GPS breadcrumb of the delivery point when the device provides one.
    if (lat !== undefined && lng !== undefined) {
      await tx.deliveryLocationUpdate.create({
        data: { shipmentId, lat, lng, agentId },
      })
    }

    // Update Order Status (if all shipments delivered)
    const remainingShipments = await tx.shipment.count({
      where: { orderId: order.id, status: { not: 'DELIVERED_COD_COLLECTED' } },
    })
    if (remainingShipments === 0) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'DELIVERED' },
      })
    }

    // Create Transactions + update balance
    await tx.transaction.create({
      data: {
        sellerId: seller.id,
        orderId: order.id,
        amount: ownerShare,
        type: 'COMMISSION_OWNER',
        status: 'PAID',
        description: `Commission (8%) for Order ${order.reference}`,
      },
    })
    await tx.transaction.create({
      data: {
        sellerId: seller.id,
        orderId: order.id,
        amount: managerShare,
        type: 'COMMISSION_MANAGER',
        status: 'PAID',
        description: `Commission (2%) for Order ${order.reference}`,
      },
    })
    await tx.transaction.create({
      data: {
        sellerId: seller.id,
        orderId: order.id,
        amount: payoutAmount,
        type: 'PAYOUT',
        status: 'PENDING',
        description: `Payout for Order ${order.reference}`,
      },
    })
    await tx.store.update({
      where: { id: seller.id },
      data: { balance: { increment: payoutAmount } },
    })

    // 6. Add Loyalty Points (1pt per 100 DZD)
    if (order.buyerId) {
      const pointsToAdd = Math.floor(order.totalAmount / 100)
      if (pointsToAdd > 0) {
        await tx.loyaltyPoints.upsert({
          where: { buyerId: order.buyerId },
          update: {
            balance: { increment: pointsToAdd },
            lifetimeEarned: { increment: pointsToAdd },
          },
          create: {
            buyerId: order.buyerId,
            balance: pointsToAdd,
            lifetimeEarned: pointsToAdd,
          },
        })
        await tx.pointsTransaction.create({
          data: {
            buyerId: order.buyerId,
            orderId: order.id,
            amount: pointsToAdd,
            type: 'EARNED_PURCHASE',
            description: `Earned ${pointsToAdd} points for Order ${order.reference}`,
          },
        })
      }
    }

    return updatedShipment
  })

  // 7. Fire Server-Side Meta Pixel (Completion) — no-ops when unconfigured.
  await trackServerEvent('Purchase', {
    value: order.totalAmount,
    currency: 'DZD',
    eventId: `delivery-${order.id}`,
  })

  await broadcast(`store-${seller.id}`, 'shipment:update', {
    shipmentId,
    status: 'DELIVERED_COD_COLLECTED',
    reference: order.reference,
  })
  await broadcast(`agent-${agentId}`, 'shipment:update', {
    shipmentId,
    status: 'DELIVERED_COD_COLLECTED',
  })

  return {
    success: true,
    shipment: updatedShipment,
    settlement: {
      reference: order.reference,
      totalCommission,
      ownerShare,
      managerShare,
      payoutAmount,
    },
  }
}

export const MAX_DELIVERY_ATTEMPTS = 3

/**
 * Records a failed delivery attempt.
 *
 * Attempts below the limit are rescheduled for the next day; on the third the
 * parcel is marked RETURNED, the order is closed as RETURNED and the seller is
 * notified. Stock is not restored automatically — the seller confirms the
 * parcel came back in sellable condition first.
 */
export async function failDelivery({
  shipmentId,
  agentId,
  reason,
  note,
}: {
  shipmentId: string
  agentId: string
  reason: string
  note?: string
}) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      order: { select: { id: true, reference: true } },
      seller: { select: { name: true, user: { select: { email: true, phone: true } } } },
    },
  })
  if (!shipment) throw new FulfillmentError('Shipment not found', 404)
  if (shipment.status === 'DELIVERED_COD_COLLECTED')
    throw new FulfillmentError('Already delivered', 409)
  if (shipment.agentId && shipment.agentId !== agentId)
    throw new FulfillmentError('Shipment is assigned to another agent', 403)

  const attemptCount = shipment.attemptCount + 1
  const exhausted = attemptCount >= MAX_DELIVERY_ATTEMPTS

  const nextDay = new Date()
  nextDay.setDate(nextDay.getDate() + 1)
  nextDay.setHours(9, 0, 0, 0)

  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: exhausted ? 'RETURNED' : 'FAILED',
        agentId: shipment.agentId ?? agentId,
        failureReason: reason,
        agentNote: note,
        attemptCount,
        scheduledFor: exhausted ? null : nextDay,
      },
    })

    // The parent order only closes when no shipment can still be delivered.
    const stillOpen = await tx.shipment.count({
      where: {
        orderId: shipment.orderId,
        id: { not: shipmentId },
        status: { notIn: ['RETURNED', 'DELIVERED_COD_COLLECTED'] },
      },
    })
    if (exhausted && stillOpen === 0) {
      await tx.order.update({
        where: { id: shipment.orderId },
        data: { status: 'RETURNED' },
      })
    }

    await tx.auditLog.create({
      data: {
        userId: agentId,
        userRole: 'AGENT',
        action: 'STATUS_CHANGE',
        entity: 'ORDER',
        entityId: shipment.orderId,
        oldState: { status: shipment.status, attemptCount: shipment.attemptCount },
        newState: {
          status: exhausted ? 'RETURNED' : 'FAILED',
          attemptCount,
          scheduledFor: exhausted ? null : nextDay.toISOString(),
        },
        reason,
      },
    })
  })

  if (exhausted) {
    const message = templates.parcelReturned(shipment.order.reference)
    await notify({
      email: shipment.seller.user.email,
      phone: shipment.seller.user.phone,
      subject: message.subject,
      body: message.body,
    })
  }

  await broadcast(`agent-${agentId}`, 'shipment:update', {
    shipmentId,
    status: exhausted ? 'RETURNED' : 'FAILED',
    attemptCount,
  })

  return {
    attemptCount,
    maxAttempts: MAX_DELIVERY_ATTEMPTS,
    returned: exhausted,
    rescheduledFor: exhausted ? null : nextDay.toISOString(),
  }
}
