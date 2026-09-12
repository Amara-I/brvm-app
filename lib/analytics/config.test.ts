import { describe, expect, it } from "vitest";
import { getAnalyticsRetentionDays, isAnalyticsTrackingEnabled } from "./config";

describe("isAnalyticsTrackingEnabled", () => {
  it("est activé par défaut", () => {
    expect(isAnalyticsTrackingEnabled({})).toBe(true);
  });

  it("se désactive via ANALYTICS_TRACKING_ENABLED", () => {
    expect(isAnalyticsTrackingEnabled({ ANALYTICS_TRACKING_ENABLED: "false" })).toBe(false);
    expect(isAnalyticsTrackingEnabled({ ANALYTICS_TRACKING_ENABLED: "true" })).toBe(true);
  });

  it("honore NEXT_PUBLIC_ si le flag serveur est absent", () => {
    expect(isAnalyticsTrackingEnabled({ NEXT_PUBLIC_ANALYTICS_TRACKING_ENABLED: "false" })).toBe(false);
  });
});

describe("getAnalyticsRetentionDays", () => {
  it("vaut 90 jours par défaut et borne les valeurs aberrantes", () => {
    expect(getAnalyticsRetentionDays({})).toBe(90);
    expect(getAnalyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: "30" })).toBe(30);
    expect(getAnalyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: "1" })).toBe(90);
    expect(getAnalyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: "nope" })).toBe(90);
  });
});
