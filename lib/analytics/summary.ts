import { prisma } from "@/lib/prisma";
import { getAnalyticsRetentionDays } from "./config";
import { fillDailySeries, rankCounts, sinceDate, type CountRow, type DailyPoint } from "./aggregate";
import { featureLabel } from "./features";
import { purgeExpiredAnalyticsEvents } from "./persist";
import { getNotificationAnalytics, type NotificationAnalytics } from "../notifications/analytics";
import { isMissingDatabaseObject } from "../db/is-database-unavailable";

export type AnalyticsSummary = {
  days: 7 | 30;
  retentionDays: number;
  totals: {
    events: number;
    pageViews: number;
    clicks: number;
    uniqueSessions: number;
    authenticatedUsers: number;
  };
  daily: DailyPoint[];
  topFeatures: CountRow[];
  topPages: CountRow[];
  topActions: CountRow[];
  notifications: NotificationAnalytics;
};

function dayKeyFromUnknown(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  return null;
}

export async function getAnalyticsSummary(days: 7 | 30, now = new Date()): Promise<AnalyticsSummary> {
  await purgeExpiredAnalyticsEvents(now).catch(() => 0);

  const since = sinceDate(days, now);
  const where = { occurredAt: { gte: since } };

  const [totals, pageViews, clicks, featureGroups, pathGroups, actionGroups, dailyRaw, uniqueRaw] =
    await Promise.all([
      prisma.analyticsEvent.count({ where }),
      prisma.analyticsEvent.count({ where: { ...where, name: "page_view" } }),
      prisma.analyticsEvent.count({
        where: { ...where, name: { in: ["nav_click", "feature_click"] } },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["feature"],
        where,
        _count: { _all: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["path"],
        where,
        _count: { _all: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["action"],
        where: { ...where, action: { not: null } },
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ day: Date | string; count: bigint | number }>>`
        SELECT date_trunc('day', occurred_at) AS day, count(*)::int AS count
        FROM analytics_events
        WHERE occurred_at >= ${since}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<Array<{ sessions: bigint | number; users: bigint | number }>>`
        SELECT
          count(DISTINCT session_id)::int AS sessions,
          count(DISTINCT user_id)::int AS users
        FROM analytics_events
        WHERE occurred_at >= ${since}
      `,
    ]);

  const countsByDay: Record<string, number> = {};
  for (const row of dailyRaw) {
    const key = dayKeyFromUnknown(row.day);
    if (!key) continue;
    countsByDay[key] = Number(row.count);
  }

  const topFeatures = rankCounts(
    featureGroups.map((row) => ({
      key: row.feature,
      label: featureLabel(row.feature),
      count: row._count._all,
    }))
  );

  const topPages = rankCounts(
    pathGroups.map((row) => ({
      key: row.path,
      label: row.path,
      count: row._count._all,
    }))
  );

  const topActions = rankCounts(
    actionGroups
      .filter((row): row is typeof row & { action: string } => Boolean(row.action))
      .map((row) => ({
        key: row.action,
        label: row.action,
        count: row._count._all,
      }))
  );

  return {
    days,
    retentionDays: getAnalyticsRetentionDays(),
    totals: {
      events: totals,
      pageViews,
      clicks,
      uniqueSessions: Number(uniqueRaw[0]?.sessions ?? 0),
      authenticatedUsers: Number(uniqueRaw[0]?.users ?? 0),
    },
    daily: fillDailySeries(countsByDay, days, now),
    topFeatures,
    topPages,
    topActions,
    notifications: await getNotificationAnalytics(days, now).catch((err) => {
      if (isMissingDatabaseObject(err)) {
        return {
          created: 0,
          read: 0,
          opened: 0,
          unread: 0,
          emailed: 0,
          byType: [],
          daily: fillDailySeries({}, days, now).map((p) => ({ ...p, opened: 0 })),
        };
      }
      throw err;
    }),
  };
}
