import { afterEach, describe, expect, it } from "vitest";
import { getConnectorFeatureFlags, getHistoryBackfillFlags } from "./connector-config";

describe("getConnectorFeatureFlags", () => {
  const keys = [
    "INGESTION_ENABLE_BRVM_INDICES",
    "INGESTION_ENABLE_BRVM_QUOTES",
    "INGESTION_ENABLE_SIKAFINANCE_INDICES",
    "INGESTION_ENABLE_SIKAFINANCE_QUOTES",
    "INGESTION_ENABLE_RICHBOURSE_INDICES",
    "INGESTION_ENABLE_RICHBOURSE_QUOTES",
    "INGESTION_ENABLE_HISTORY_BACKFILL",
    "INGESTION_ENABLE_SIKA_DAILY_HISTORY",
    "INGESTION_HISTORY_BACKFILL_ON_CRON",
  ];

  afterEach(() => {
    for (const key of keys) delete process.env[key];
  });

  it("active les cours Sikafinance par défaut (page A–Z)", () => {
    delete process.env.INGESTION_ENABLE_SIKAFINANCE_QUOTES;
    expect(getConnectorFeatureFlags().sikafinanceQuotes).toBe(true);
  });

  it("autorise une désactivation d'urgence via l'env", () => {
    process.env.INGESTION_ENABLE_SIKAFINANCE_QUOTES = "false";
    expect(getConnectorFeatureFlags().sikafinanceQuotes).toBe(false);
  });

  it("laisse le backfill historique activé, hors cron quotidien par défaut", () => {
    delete process.env.INGESTION_ENABLE_HISTORY_BACKFILL;
    delete process.env.INGESTION_HISTORY_BACKFILL_ON_CRON;
    const flags = getHistoryBackfillFlags();
    expect(flags.enabled).toBe(true);
    expect(flags.daily).toBe(true);
    expect(flags.onDailyCron).toBe(false);
  });
});
