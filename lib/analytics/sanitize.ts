import {
  featureFromPath,
  isAnalyticsEventName,
  isAnalyticsFeature,
  shouldTrackPath,
  type AnalyticsEventName,
  type AnalyticsFeature,
} from "./features";

export type IncomingAnalyticsEvent = {
  name?: unknown;
  feature?: unknown;
  path?: unknown;
  action?: unknown;
  sessionId?: unknown;
};

export type SanitizedAnalyticsEvent = {
  name: AnalyticsEventName;
  feature: AnalyticsFeature;
  path: string;
  action: string | null;
  sessionId: string | null;
};

/// Chemin interne uniquement : pas de query, hash, email, ni caractères hors URL path.
export function sanitizeAnalyticsPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let path = raw.trim().split("?")[0]?.split("#")[0] ?? "";
  if (!path.startsWith("/")) return null;
  if (path.includes("@")) return null;
  if (path.length > 160) path = path.slice(0, 160);
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (!/^\/[A-Za-z0-9/_\-.]*$/.test(path)) return null;
  return path;
}

export function sanitizeAnalyticsAction(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const action = raw.trim().slice(0, 48);
  if (!/^[A-Za-z0-9:_\-.]+$/.test(action)) return null;
  return action;
}

export function sanitizeSessionId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return null;
  return id;
}

export function sanitizeAnalyticsEvent(raw: IncomingAnalyticsEvent): SanitizedAnalyticsEvent | null {
  if (typeof raw.name !== "string" || !isAnalyticsEventName(raw.name)) return null;
  const path = sanitizeAnalyticsPath(raw.path);
  if (!path || !shouldTrackPath(path)) return null;

  let feature: AnalyticsFeature;
  if (typeof raw.feature === "string" && isAnalyticsFeature(raw.feature)) {
    feature = raw.feature;
  } else {
    feature = featureFromPath(path);
  }

  return {
    name: raw.name,
    feature,
    path,
    action: sanitizeAnalyticsAction(raw.action),
    sessionId: sanitizeSessionId(raw.sessionId),
  };
}

export function sanitizeAnalyticsBatch(raw: unknown, max = 20): SanitizedAnalyticsEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: SanitizedAnalyticsEvent[] = [];
  for (const item of raw.slice(0, max)) {
    if (!item || typeof item !== "object") continue;
    const sanitized = sanitizeAnalyticsEvent(item as IncomingAnalyticsEvent);
    if (sanitized) out.push(sanitized);
  }
  return out;
}
