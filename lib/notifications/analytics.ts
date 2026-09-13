import { prisma } from "../prisma";
import { fillDailySeries, rankCounts, sinceDate, type CountRow, type DailyPoint } from "../analytics/aggregate";
import { NOTIFICATION_TYPE_LABELS, type NotificationTypeCode } from "./types";

export type NotificationAnalytics = {
  created: number;
  read: number;
  opened: number;
  unread: number;
  emailed: number;
  byType: CountRow[];
  daily: Array<DailyPoint & { opened: number }>;
};

function dayKey(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  return null;
}

export async function getNotificationAnalytics(days: 7 | 30, now = new Date()): Promise<NotificationAnalytics> {
  const since = sinceDate(days, now);
  const where = { createdAt: { gte: since } };

  const [created, read, opened, unread, emailed, typeGroups, dailyRaw] = await Promise.all([
    prisma.notificationEvent.count({ where }),
    prisma.notificationEvent.count({ where: { ...where, readAt: { not: null } } }),
    prisma.notificationEvent.count({ where: { ...where, openedAt: { not: null } } }),
    prisma.notificationEvent.count({ where: { ...where, readAt: null } }),
    prisma.notificationEvent.count({ where: { ...where, emailSentAt: { not: null } } }),
    prisma.notificationEvent.groupBy({
      by: ["type"],
      where,
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ day: Date | string; created: bigint | number; opened: bigint | number }>>`
      SELECT
        date_trunc('day', created_at) AS day,
        count(*)::int AS created,
        count(opened_at)::int AS opened
      FROM notification_events
      WHERE created_at >= ${since}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const createdByDay: Record<string, number> = {};
  const openedByDay: Record<string, number> = {};
  for (const row of dailyRaw) {
    const key = dayKey(row.day);
    if (!key) continue;
    createdByDay[key] = Number(row.created);
    openedByDay[key] = Number(row.opened);
  }

  const daily = fillDailySeries(createdByDay, days, now).map((point) => ({
    ...point,
    opened: openedByDay[point.date] ?? 0,
  }));

  return {
    created,
    read,
    opened,
    unread,
    emailed,
    byType: rankCounts(
      typeGroups.map((row) => ({
        key: row.type,
        label: NOTIFICATION_TYPE_LABELS[row.type as NotificationTypeCode] ?? row.type,
        count: row._count._all,
      }))
    ),
    daily,
  };
}
