import { prisma } from "@/lib/prisma";

/**
 * Per-user preferences with typed defaults, mirroring src/lib/settings.ts.
 * Columns hold the values shared across roles; the `notifications` and
 * `settings` JSON blobs hold the role-specific extras.
 */

export interface NotificationPrefs {
  // Manager
  newSellerRegistered?: boolean;
  sellerSuspended?: boolean;
  dailyRegionalReport?: boolean;
  // Seller
  emailNewOrder?: boolean;
  smsNewOrder?: boolean;
  emailStockAlert?: boolean;
  emailWeeklyReport?: boolean;
  // Agent
  soundNotifications?: boolean;
  pushNotifications?: boolean;
  // Support
  emailNewTicket?: boolean;
  pushNewTicket?: boolean;
  dailyTicketSummary?: boolean;
  // Accountant
  dailyReconciliationReminder?: boolean;
}

export interface RoleSettings {
  // Wilaya manager
  minCommissionPayout?: number;
  payoutFrequency?: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  rib?: string;
  // Agent
  gpsEnabled?: boolean;
  gpsPingIntervalSec?: number;
  showDistance?: boolean;
  autoSubmitEod?: boolean;
  eodReportTime?: string;
  cashDropOffLocation?: string;
}

export const DEFAULT_NOTIFICATIONS: Required<NotificationPrefs> = {
  newSellerRegistered: true,
  sellerSuspended: true,
  dailyRegionalReport: false,
  emailNewOrder: true,
  smsNewOrder: false,
  emailStockAlert: true,
  emailWeeklyReport: false,
  soundNotifications: true,
  pushNotifications: true,
  emailNewTicket: true,
  pushNewTicket: false,
  dailyTicketSummary: false,
  dailyReconciliationReminder: false,
};

export const DEFAULT_ROLE_SETTINGS: Required<RoleSettings> = {
  minCommissionPayout: 500,
  payoutFrequency: "MONTHLY",
  rib: "",
  gpsEnabled: true,
  gpsPingIntervalSec: 30,
  showDistance: true,
  autoSubmitEod: false,
  eodReportTime: "18:00",
  cashDropOffLocation: "",
};

export interface ResolvedPreferences {
  language: string;
  darkMode: boolean;
  promoSms: boolean;
  promoEmail: boolean;
  autoApplyPoints: boolean;
  defaultOrderFilter: string;
  showCodBanner: boolean;
  notifications: Required<NotificationPrefs>;
  settings: Required<RoleSettings>;
}

export async function getPreferences(profileId: string): Promise<ResolvedPreferences> {
  const row = await prisma.userPreferences.findUnique({ where: { profileId } });
  return {
    language: row?.language ?? "fr",
    darkMode: row?.darkMode ?? false,
    promoSms: row?.promoSms ?? true,
    promoEmail: row?.promoEmail ?? true,
    autoApplyPoints: row?.autoApplyPoints ?? false,
    defaultOrderFilter: row?.defaultOrderFilter ?? "ALL",
    showCodBanner: row?.showCodBanner ?? true,
    notifications: {
      ...DEFAULT_NOTIFICATIONS,
      ...((row?.notifications as NotificationPrefs) ?? {}),
    },
    settings: {
      ...DEFAULT_ROLE_SETTINGS,
      ...((row?.settings as RoleSettings) ?? {}),
    },
  };
}

export async function savePreferences(
  profileId: string,
  patch: {
    language?: string;
    darkMode?: boolean;
    promoSms?: boolean;
    promoEmail?: boolean;
    autoApplyPoints?: boolean;
    defaultOrderFilter?: string;
    showCodBanner?: boolean;
    notifications?: NotificationPrefs;
    settings?: RoleSettings;
  }
): Promise<ResolvedPreferences> {
  const current = await getPreferences(profileId);
  const { notifications, settings, ...columns } = patch;

  const nextNotifications = { ...current.notifications, ...(notifications ?? {}) };
  const nextSettings = { ...current.settings, ...(settings ?? {}) };

  await prisma.userPreferences.upsert({
    where: { profileId },
    update: {
      ...columns,
      notifications: nextNotifications,
      settings: nextSettings,
    },
    create: {
      profileId,
      ...columns,
      notifications: nextNotifications,
      settings: nextSettings,
    },
  });

  return { ...current, ...columns, notifications: nextNotifications, settings: nextSettings };
}
