import { NotificationDeliveryMode } from "@prisma/client";
import { prisma } from "../prisma";
import { DEFAULT_PREFS, type PrefsSnapshot } from "./types";

function rowToPrefs(row: {
  priceEnabled: boolean;
  signalEnabled: boolean;
  portfolioEnabled: boolean;
  indexEnabled: boolean;
  systemEnabled: boolean;
  channelInApp: boolean;
  channelEmail: boolean;
  deliveryMode: NotificationDeliveryMode;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  sessionReminders: boolean;
  portfolioMovePct: { toString(): string } | number;
  indexMovePct: { toString(): string } | number;
}): PrefsSnapshot {
  return {
    priceEnabled: row.priceEnabled,
    signalEnabled: row.signalEnabled,
    portfolioEnabled: row.portfolioEnabled,
    indexEnabled: row.indexEnabled,
    systemEnabled: row.systemEnabled,
    channelInApp: row.channelInApp,
    channelEmail: row.channelEmail,
    deliveryMode: row.deliveryMode,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    sessionReminders: row.sessionReminders,
    portfolioMovePct: Number(row.portfolioMovePct),
    indexMovePct: Number(row.indexMovePct),
  };
}

export async function getOrCreatePrefs(userId: string): Promise<PrefsSnapshot> {
  const existing = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (existing) return rowToPrefs(existing);
  const created = await prisma.notificationPreference.create({
    data: { userId, updatedAt: new Date() },
  });
  return rowToPrefs(created);
}

export async function getPrefsMap(userIds: string[]): Promise<Map<string, PrefsSnapshot>> {
  const map = new Map<string, PrefsSnapshot>();
  if (userIds.length === 0) return map;
  const rows = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds } },
  });
  const seen = new Set<string>();
  for (const row of rows) {
    map.set(row.userId, rowToPrefs(row));
    seen.add(row.userId);
  }
  for (const id of userIds) {
    if (!seen.has(id)) map.set(id, { ...DEFAULT_PREFS });
  }
  return map;
}

export type PrefsPatch = Partial<PrefsSnapshot>;

export async function updatePrefs(userId: string, patch: PrefsPatch): Promise<PrefsSnapshot> {
  await getOrCreatePrefs(userId);
  const updated = await prisma.notificationPreference.update({
    where: { userId },
    data: {
      ...(patch.priceEnabled != null ? { priceEnabled: patch.priceEnabled } : {}),
      ...(patch.signalEnabled != null ? { signalEnabled: patch.signalEnabled } : {}),
      ...(patch.portfolioEnabled != null ? { portfolioEnabled: patch.portfolioEnabled } : {}),
      ...(patch.indexEnabled != null ? { indexEnabled: patch.indexEnabled } : {}),
      ...(patch.systemEnabled != null ? { systemEnabled: patch.systemEnabled } : {}),
      ...(patch.channelInApp != null ? { channelInApp: patch.channelInApp } : {}),
      ...(patch.channelEmail != null ? { channelEmail: patch.channelEmail } : {}),
      ...(patch.deliveryMode != null ? { deliveryMode: patch.deliveryMode } : {}),
      ...(patch.quietHoursStart !== undefined ? { quietHoursStart: patch.quietHoursStart } : {}),
      ...(patch.quietHoursEnd !== undefined ? { quietHoursEnd: patch.quietHoursEnd } : {}),
      ...(patch.sessionReminders != null ? { sessionReminders: patch.sessionReminders } : {}),
      ...(patch.portfolioMovePct != null ? { portfolioMovePct: patch.portfolioMovePct } : {}),
      ...(patch.indexMovePct != null ? { indexMovePct: patch.indexMovePct } : {}),
    },
  });
  return rowToPrefs(updated);
}
