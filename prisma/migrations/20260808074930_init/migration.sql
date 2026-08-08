-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'WILAYA_MANAGER', 'SELLER', 'ACCOUNTANT', 'ERP_MANAGER', 'AGENT', 'BUYER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "CheckoutType" AS ENUM ('FAST', 'CART');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED_COD_COLLECTED', 'FAILED', 'RETURNED');

-- CreateEnum
CREATE TYPE "TransType" AS ENUM ('COMMISSION_OWNER', 'COMMISSION_MANAGER', 'PAYOUT', 'REFUND');

-- CreateEnum
CREATE TYPE "TransStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PointsType" AS ENUM ('EARNED_PURCHASE', 'EARNED_REVIEW', 'EARNED_BIRTHDAY', 'REDEEMED_DISCOUNT', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BUYER',
    "wilayaCode" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wilayas" (
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "wilayas_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "communes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "wilayaCode" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "communes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "wilayaCode" INTEGER NOT NULL,
    "address" TEXT,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "deliveryProviderType" TEXT NOT NULL DEFAULT 'ZEEM_DEFAULT',
    "customApiKey" TEXT,
    "customApiSecret" TEXT,
    "customAccountNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "images" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "attributes" JSONB NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "compareAtPrice" DOUBLE PRECISION,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "buyerId" TEXT,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ownerShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "managerShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "checkoutType" "CheckoutType" NOT NULL,
    "wilayaCode" INTEGER,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "sellerId" TEXT NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "deliveryCompany" TEXT NOT NULL DEFAULT 'YALIDINE',
    "trackingNumber" TEXT,
    "waybillUrl" TEXT,
    "shippingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "codAmount" DOUBLE PRECISION NOT NULL,
    "actualCollected" DOUBLE PRECISION,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING_PICKUP',
    "failureReason" TEXT,
    "agentId" TEXT,
    "agentNote" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "TransType" NOT NULL,
    "status" "TransStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rates" (
    "id" TEXT NOT NULL,
    "wilayaCode" INTEGER NOT NULL,
    "courierType" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 250.0,
    "pricePerKg" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "estimatedDays" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shipping_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_points" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeRedeemed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_transactions" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" INTEGER NOT NULL,
    "type" "PointsType" NOT NULL,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" "Role" NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldState" JSONB,
    "newState" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "orderId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "images" TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "sellerReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_location_updates" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" INTEGER,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_location_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_phone_key" ON "profiles"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "stores_userId_key" ON "stores"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_rates_wilayaCode_courierType_key" ON "shipping_rates"("wilayaCode", "courierType");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_points_buyerId_key" ON "loyalty_points"("buyerId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "delivery_location_updates_shipmentId_idx" ON "delivery_location_updates"("shipmentId");

-- CreateIndex
CREATE INDEX "delivery_location_updates_createdAt_idx" ON "delivery_location_updates"("createdAt");

-- AddForeignKey
ALTER TABLE "communes" ADD CONSTRAINT "communes_wilayaCode_fkey" FOREIGN KEY ("wilayaCode") REFERENCES "wilayas"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_wilayaCode_fkey" FOREIGN KEY ("wilayaCode") REFERENCES "wilayas"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_wilayaCode_fkey" FOREIGN KEY ("wilayaCode") REFERENCES "wilayas"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_wilayaCode_fkey" FOREIGN KEY ("wilayaCode") REFERENCES "wilayas"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_location_updates" ADD CONSTRAINT "delivery_location_updates_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_location_updates" ADD CONSTRAINT "delivery_location_updates_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
