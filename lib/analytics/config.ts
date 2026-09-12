/// Feature flags analytique première partie.
/// - `ANALYTICS_TRACKING_ENABLED` : écriture serveur (POST /api/analytics/events).
/// - `NEXT_PUBLIC_ANALYTICS_TRACKING_ENABLED` : le client n'envoie rien si false.
/// Défaut : activé. En local : passer les deux à `false` pour ne rien journaliser.

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

type EnvMap = Record<string, string | undefined>;

export function isAnalyticsTrackingEnabled(env: EnvMap = process.env): boolean {
  const server = env.ANALYTICS_TRACKING_ENABLED;
  const pub = env.NEXT_PUBLIC_ANALYTICS_TRACKING_ENABLED;
  if (server !== undefined && server !== "") {
    return server === "1" || server.toLowerCase() === "true";
  }
  if (pub !== undefined && pub !== "") {
    return pub === "1" || pub.toLowerCase() === "true";
  }
  return true;
}

export function isClientTrackingEnabled(): boolean {
  return envFlag("NEXT_PUBLIC_ANALYTICS_TRACKING_ENABLED", true);
}

export const DEFAULT_ANALYTICS_RETENTION_DAYS = 90;

export function getAnalyticsRetentionDays(env: EnvMap = process.env): number {
  const raw = env.ANALYTICS_RETENTION_DAYS;
  if (!raw) return DEFAULT_ANALYTICS_RETENTION_DAYS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 7 || n > 730) return DEFAULT_ANALYTICS_RETENTION_DAYS;
  return n;
}
