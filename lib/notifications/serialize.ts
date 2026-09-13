import type { AlertRule, NotificationEvent, NotificationType } from "@prisma/client";
import { NOTIFICATION_TYPE_LABELS, type NotificationTypeCode } from "./types";

export function serializeNotification(ev: NotificationEvent) {
  return {
    id: ev.id,
    type: ev.type,
    typeLabel: NOTIFICATION_TYPE_LABELS[ev.type as NotificationTypeCode] ?? ev.type,
    title: ev.title,
    body: ev.body,
    href: ev.href,
    ticker: ev.ticker,
    indexCode: ev.indexCode,
    readAt: ev.readAt?.toISOString() ?? null,
    openedAt: ev.openedAt?.toISOString() ?? null,
    createdAt: ev.createdAt.toISOString(),
  };
}

export function serializeAlertRule(rule: AlertRule) {
  return {
    id: rule.id,
    kind: rule.kind,
    ticker: rule.ticker,
    indexCode: rule.indexCode,
    params: rule.params,
    enabled: rule.enabled,
    lastFiredAt: rule.lastFiredAt?.toISOString() ?? null,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export function isFilterType(value: string | null): value is NotificationType {
  return value === "PRIX" || value === "SIGNAUX" || value === "PORTEFEUILLE" || value === "INDICES" || value === "SYSTEME";
}
