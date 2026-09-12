import { prisma } from "@/lib/prisma";
import { getAnalyticsRetentionDays } from "./config";
import type { SanitizedAnalyticsEvent } from "./sanitize";

export async function persistAnalyticsEvents(
  events: SanitizedAnalyticsEvent[],
  userId: string | null
): Promise<number> {
  if (events.length === 0) return 0;
  const result = await prisma.analyticsEvent.createMany({
    data: events.map((event) => ({
      name: event.name,
      feature: event.feature,
      path: event.path,
      action: event.action,
      sessionId: event.sessionId,
      userId,
    })),
  });
  return result.count;
}

export async function purgeExpiredAnalyticsEvents(now = new Date()): Promise<number> {
  const days = getAnalyticsRetentionDays();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.analyticsEvent.deleteMany({
    where: { occurredAt: { lt: cutoff } },
  });
  return result.count;
}
