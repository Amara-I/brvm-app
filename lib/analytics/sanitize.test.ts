import { describe, expect, it } from "vitest";
import { sanitizeAnalyticsBatch, sanitizeAnalyticsEvent, sanitizeAnalyticsPath } from "./sanitize";

describe("sanitizeAnalyticsPath", () => {
  it("accepte un chemin interne propre", () => {
    expect(sanitizeAnalyticsPath("/screener")).toBe("/screener");
    expect(sanitizeAnalyticsPath("/actions/SNTS/")).toBe("/actions/SNTS");
  });

  it("retire query, hash et refuse les e-mails", () => {
    expect(sanitizeAnalyticsPath("/graphes?ticker=SNTS#ohlc")).toBe("/graphes");
    expect(sanitizeAnalyticsPath("/x?email=a@b.c")).toBe("/x");
    expect(sanitizeAnalyticsPath("/a@b.c")).toBeNull();
    expect(sanitizeAnalyticsPath("https://evil.test/screener")).toBeNull();
  });
});

describe("sanitizeAnalyticsEvent", () => {
  it("normalise un événement valide et ignore userId client", () => {
    const event = sanitizeAnalyticsEvent({
      name: "feature_click",
      feature: "graphes",
      path: "/graphes?ticker=SNTS",
      action: "range:1A",
      sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    expect(event).toEqual({
      name: "feature_click",
      feature: "graphes",
      path: "/graphes",
      action: "range:1A",
      sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
  });

  it("dérive la feature depuis le chemin si absente", () => {
    const event = sanitizeAnalyticsEvent({
      name: "page_view",
      path: "/actions/SGBC",
    });
    expect(event?.feature).toBe("company_sheet");
  });

  it("rejette les événements admin, noms inconnus ou actions sales", () => {
    expect(sanitizeAnalyticsEvent({ name: "page_view", path: "/admin/analytics" })).toBeNull();
    expect(sanitizeAnalyticsEvent({ name: "hack", path: "/screener" })).toBeNull();
    expect(sanitizeAnalyticsEvent({ name: "page_view", path: "/screener", action: "a b" })?.action).toBeNull();
  });
});

describe("sanitizeAnalyticsBatch", () => {
  it("borne le lot et ignore les entrées invalides", () => {
    const events = sanitizeAnalyticsBatch(
      [
        { name: "page_view", path: "/marche" },
        { name: "nope", path: "/marche" },
        null,
        { name: "nav_click", path: "/screener", action: "nav" },
      ],
      2
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.feature).toBe("marche");
  });
});
