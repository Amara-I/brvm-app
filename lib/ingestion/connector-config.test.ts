import { afterEach, describe, expect, it } from "vitest";
import { getConnectorFeatureFlags } from "./connector-config";

describe("getConnectorFeatureFlags", () => {
  const keys = [
    "INGESTION_ENABLE_BRVM_INDICES",
    "INGESTION_ENABLE_BRVM_QUOTES",
    "INGESTION_ENABLE_SIKAFINANCE_INDICES",
    "INGESTION_ENABLE_SIKAFINANCE_QUOTES",
    "INGESTION_ENABLE_RICHBOURSE_INDICES",
    "INGESTION_ENABLE_RICHBOURSE_QUOTES",
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
});
