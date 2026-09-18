import { describe, expect, it } from "vitest";
import { documentRefreshSkipReason, parseDocumentRefreshSearchParams } from "./run-document-refresh";

describe("documentRefreshSkipReason", () => {
  it("refuse si le flag documents est off", () => {
    expect(
      documentRefreshSkipReason({ documentsEnabled: false, obConfigured: true })
    ).toMatch(/INGESTION_ENABLE_OB_DOCUMENTS/);
  });

  it("refuse si la clé OuestBourse est absente", () => {
    expect(
      documentRefreshSkipReason({ documentsEnabled: true, obConfigured: false })
    ).toMatch(/OUESTBOURSE_SUPABASE_ANON_KEY/);
  });

  it("laisse passer si le catalogue est branché", () => {
    expect(documentRefreshSkipReason({ documentsEnabled: true, obConfigured: true })).toBeNull();
  });
});

describe("parseDocumentRefreshSearchParams", () => {
  it("lit tickers, budget et reprise", () => {
    const parsed = parseDocumentRefreshSearchParams(
      new URLSearchParams("tickers=SNTS,sgbc&budgetMs=60000&maxTickers=2&after=BICC")
    );
    expect(parsed.tickers).toEqual(["SNTS", "SGBC"]);
    expect(parsed.timeBudgetMs).toBe(60_000);
    expect(parsed.maxTickers).toBe(2);
    expect(parsed.resumeAfterTicker).toBe("BICC");
    expect(parsed.resumeInclusive).toBe(false);
    expect(parsed.includeFundamentals).toBe(true);
  });

  it("noFundamentals et noResume désactivent les options", () => {
    const parsed = parseDocumentRefreshSearchParams(
      new URLSearchParams("noFundamentals=1&noResume=true")
    );
    expect(parsed.includeFundamentals).toBe(false);
    expect(parsed.resume).toBe(false);
  });
});
