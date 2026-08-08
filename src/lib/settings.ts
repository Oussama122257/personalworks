import { prisma } from "@/lib/prisma";

/**
 * Platform settings.
 *
 * Values live in the SystemSetting table, one row per group. Every group has a
 * typed default here, so a fresh install works before anything is saved and a
 * newly-added option appears without a migration or a backfill.
 */

export interface GeneralSettings {
  platformName: string;
  defaultCommissionRate: number;
  ownerShare: number;
  managerShare: number;
  defaultCurrency: "DZD" | "EUR" | "USD";
  defaultLanguage: "fr" | "ar" | "en";
  maintenanceMode: boolean;
}

export interface FeatureFlags {
  aiSearch: boolean;
  aiProductDescription: boolean;
  aiSizeRecommender: boolean;
  loyaltyPoints: boolean;
  wishlist: boolean;
  reviewsWithPhotos: boolean;
  guestCheckout: boolean;
  multiVendorCart: boolean;
}

export interface ShippingDefaults {
  defaultShippingCompany: "YALIDINE" | "ZR_EXPRESS" | "POSTE";
  freeShippingThreshold: number;
  maxDeliveryAttempts: number;
  autoCancelAfterDays: number;
}

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoLight: string | null;
  logoDark: string | null;
  favicon: string | null;
  customCss: string;
}

export interface FiscalSettings {
  vatRate: number;
  invoiceFooter: string;
  invoiceLogo: string | null;
  invoiceNumberFormat: string;
}

export interface PayoutAutomation {
  autoGenerateBatches: boolean;
  batchDay: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  minSellerBalance: number;
  bankFileFormat: "CSV" | "EXCEL" | "XML";
  csvDelimiter: "," | ";" | "\t";
}

export interface ReconciliationSettings {
  codTolerancePct: number;
  autoFlagDiscrepancies: boolean;
  dailyReminder: boolean;
}

export interface ErpSettings {
  csvDelimiter: "," | ";";
  autoPublishImported: boolean;
  exportFilenamePattern: string;
  exportFields: string[];
  aiAutoTagging: boolean;
  aiConfidenceThreshold: number;
}

export interface LogisticsSettings {
  maxDeliveryRadiusKm: number;
  autoAssignAgent: boolean;
  smartRouting: boolean;
  smsAlertOnAssignment: boolean;
  expressFeePct: number;
  weekendSurcharge: number;
  heavyItemKgThreshold: number;
  heavyItemSurcharge: number;
}

export interface SupportSettings {
  autoAssignTickets: boolean;
  routingAlgorithm: "ROUND_ROBIN" | "LEAST_BUSY" | "PRIORITY";
  slaHours: number;
  escalateAfterHours: number;
  highPriorityKeywords: string;
  autoTagHighPriority: boolean;
  showOrderHistory: boolean;
  showPreviousTickets: boolean;
  allowTestOrders: boolean;
}

export interface SettingsMap {
  general: GeneralSettings;
  features: FeatureFlags;
  shipping: ShippingDefaults;
  theme: ThemeSettings;
  fiscal: FiscalSettings;
  payouts: PayoutAutomation;
  reconciliation: ReconciliationSettings;
  erp: ErpSettings;
  logistics: LogisticsSettings;
  support: SupportSettings;
}

export const DEFAULTS: SettingsMap = {
  general: {
    platformName: "Zeem",
    defaultCommissionRate: 10,
    ownerShare: 80,
    managerShare: 20,
    defaultCurrency: "DZD",
    defaultLanguage: "fr",
    maintenanceMode: false,
  },
  features: {
    aiSearch: false,
    aiProductDescription: true,
    aiSizeRecommender: false,
    loyaltyPoints: true,
    wishlist: true,
    reviewsWithPhotos: true,
    guestCheckout: true,
    multiVendorCart: true,
  },
  shipping: {
    defaultShippingCompany: "YALIDINE",
    freeShippingThreshold: 5000,
    maxDeliveryAttempts: 3,
    autoCancelAfterDays: 14,
  },
  theme: {
    primaryColor: "#E8B931",
    secondaryColor: "#0A2647",
    accentColor: "#2C7A4A",
    logoLight: null,
    logoDark: null,
    favicon: null,
    customCss: "",
  },
  fiscal: {
    vatRate: 19,
    invoiceFooter:
      "Zeem Marketplace — Document généré automatiquement. TVA algérienne au taux en vigueur.",
    invoiceLogo: null,
    invoiceNumberFormat: "INV-{YYYY}-{MM}-{SEQ}",
  },
  payouts: {
    autoGenerateBatches: false,
    batchDay: "MONDAY",
    minSellerBalance: 1000,
    bankFileFormat: "CSV",
    csvDelimiter: ",",
  },
  reconciliation: {
    codTolerancePct: 0.5,
    autoFlagDiscrepancies: true,
    dailyReminder: false,
  },
  erp: {
    csvDelimiter: ",",
    autoPublishImported: true,
    exportFilenamePattern: "catalog-{YYYYMMDD}.csv",
    exportFields: [
      "store_slug",
      "product_name",
      "category",
      "description",
      "sku",
      "size",
      "color",
      "price",
      "stock",
      "low_stock_threshold",
      "published",
    ],
    aiAutoTagging: false,
    aiConfidenceThreshold: 80,
  },
  logistics: {
    maxDeliveryRadiusKm: 50,
    autoAssignAgent: true,
    smartRouting: true,
    smsAlertOnAssignment: false,
    expressFeePct: 25,
    weekendSurcharge: 0,
    heavyItemKgThreshold: 10,
    heavyItemSurcharge: 0,
  },
  support: {
    autoAssignTickets: false,
    routingAlgorithm: "LEAST_BUSY",
    slaHours: 24,
    escalateAfterHours: 24,
    highPriorityKeywords: "fraude, litige, remboursement, avocat, plainte",
    autoTagHighPriority: true,
    showOrderHistory: true,
    showPreviousTickets: true,
    allowTestOrders: false,
  },
};

/**
 * Reads one settings group, merged over its defaults.
 *
 * A database failure falls back to the defaults rather than throwing. Two
 * reasons: `next build` prerenders pages whose metadata reads settings, and a
 * build must not require a live database; and at runtime a settings lookup is
 * never important enough to take a page down — the shipped defaults are always
 * a safe answer.
 */
export async function getSettings<K extends keyof SettingsMap>(
  key: K
): Promise<SettingsMap[K]> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (!row) return DEFAULTS[key];
    return { ...DEFAULTS[key], ...(row.value as object) } as SettingsMap[K];
  } catch (err) {
    console.error(`[settings] falling back to defaults for "${key}"`, err);
    return DEFAULTS[key];
  }
}

/** Reads every group at once (used by the admin settings page). */
export async function getAllSettings(): Promise<SettingsMap> {
  let byKey = new Map<string, object>();
  try {
    const rows = await prisma.systemSetting.findMany();
    byKey = new Map(rows.map((r) => [r.key, r.value as object]));
  } catch (err) {
    console.error("[settings] falling back to defaults for all groups", err);
  }
  const out = {} as SettingsMap;
  for (const key of Object.keys(DEFAULTS) as (keyof SettingsMap)[]) {
    // @ts-expect-error — key-wise merge is sound, TS cannot narrow the union here
    out[key] = { ...DEFAULTS[key], ...(byKey.get(key) ?? {}) };
  }
  return out;
}

/** Writes a partial update to one group, preserving unknown keys. */
export async function saveSettings<K extends keyof SettingsMap>(
  key: K,
  patch: Partial<SettingsMap[K]>,
  updatedBy?: string
): Promise<SettingsMap[K]> {
  const current = await getSettings(key);
  const next = { ...current, ...patch };
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: next as object, updatedBy },
    create: { key, value: next as object, updatedBy },
  });
  return next;
}
