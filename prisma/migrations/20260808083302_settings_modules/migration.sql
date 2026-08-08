-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phoneOtpCode" TEXT,
ADD COLUMN     "phoneOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "sessionsValidFrom" TIMESTAMP(3),
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT,
ADD COLUMN     "workingHoursEnd" TEXT,
ADD COLUMN     "workingHoursStart" TEXT;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "aiDescriptionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoConfirmOrders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoPrintWaybill" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "customProviderName" TEXT,
ADD COLUMN     "defaultCourier" TEXT NOT NULL DEFAULT 'YALIDINE',
ADD COLUMN     "defaultStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "defaultTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
ADD COLUMN     "freeShippingThreshold" DOUBLE PRECISION,
ADD COLUMN     "invoiceDetails" TEXT,
ADD COLUMN     "minPayoutThreshold" DOUBLE PRECISION NOT NULL DEFAULT 1000,
ADD COLUMN     "payoutFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "processingTime" TEXT NOT NULL DEFAULT '48h',
ADD COLUMN     "returnPolicy" TEXT,
ADD COLUMN     "returnShippingFee" TEXT NOT NULL DEFAULT 'BUYER_PAYS',
ADD COLUMN     "returnWindowDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "skuPattern" TEXT NOT NULL DEFAULT '{STORE}-{CAT}-{COLOR}-{SIZE}',
ADD COLUMN     "socialLinks" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "promoSms" BOOLEAN NOT NULL DEFAULT true,
    "promoEmail" BOOLEAN NOT NULL DEFAULT true,
    "autoApplyPoints" BOOLEAN NOT NULL DEFAULT false,
    "defaultOrderFilter" TEXT NOT NULL DEFAULT 'ALL',
    "showCodBanner" BOOLEAN NOT NULL DEFAULT true,
    "notifications" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Domicile',
    "fullName" TEXT,
    "phone" TEXT,
    "wilayaCode" INTEGER NOT NULL,
    "communeId" INTEGER NOT NULL,
    "addressLine" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canned_responses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Général',
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couriers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "apiEndpoint" TEXT,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wilaya_settings" (
    "wilayaCode" INTEGER NOT NULL,
    "displayName" TEXT,
    "shippingSurcharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoApproveSellers" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wilaya_settings_pkey" PRIMARY KEY ("wilayaCode")
);

-- CreateTable
CREATE TABLE "login_events" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_profileId_key" ON "user_preferences"("profileId");

-- CreateIndex
CREATE INDEX "addresses_profileId_idx" ON "addresses"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "couriers_code_key" ON "couriers"("code");

-- CreateIndex
CREATE INDEX "login_events_profileId_createdAt_idx" ON "login_events"("profileId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_wilayaCode_fkey" FOREIGN KEY ("wilayaCode") REFERENCES "wilayas"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "communes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wilaya_settings" ADD CONSTRAINT "wilaya_settings_wilayaCode_fkey" FOREIGN KEY ("wilayaCode") REFERENCES "wilayas"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
