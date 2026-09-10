import { describe, expect, it, afterEach } from "vitest";
import { getSearchProvider, isResearchAgentEnabled } from "./provider-factory";
import { NoOpSearchProvider } from "./search-providers/no-op-provider";
import { SerpApiSearchProvider } from "./search-providers/serpapi-provider";

const ORIGINAL_ENABLED = process.env.RESEARCH_AGENT_ENABLED;
const ORIGINAL_KEY = process.env.RESEARCH_SEARCH_API_KEY;

afterEach(() => {
  process.env.RESEARCH_AGENT_ENABLED = ORIGINAL_ENABLED;
  process.env.RESEARCH_SEARCH_API_KEY = ORIGINAL_KEY;
});

describe("isResearchAgentEnabled", () => {
  it("retourne false par défaut (variable absente)", () => {
    delete process.env.RESEARCH_AGENT_ENABLED;
    expect(isResearchAgentEnabled()).toBe(false);
  });

  it('retourne false si la variable vaut autre chose que "true"', () => {
    process.env.RESEARCH_AGENT_ENABLED = "1";
    expect(isResearchAgentEnabled()).toBe(false);
  });

  it('retourne true si la variable vaut exactement "true"', () => {
    process.env.RESEARCH_AGENT_ENABLED = "true";
    expect(isResearchAgentEnabled()).toBe(true);
  });
});

describe("getSearchProvider", () => {
  it("retombe sur NoOpSearchProvider si l'agent est désactivé, même avec une clé présente", () => {
    process.env.RESEARCH_AGENT_ENABLED = "false";
    process.env.RESEARCH_SEARCH_API_KEY = "fake-key";
    expect(getSearchProvider()).toBeInstanceOf(NoOpSearchProvider);
  });

  it("utilise GoogleNewsRssSearchProvider si l'agent est activé mais sans clé", async () => {
    const { GoogleNewsRssSearchProvider } = await import("./search-providers/google-news-rss-provider");
    process.env.RESEARCH_AGENT_ENABLED = "true";
    delete process.env.RESEARCH_SEARCH_API_KEY;
    expect(getSearchProvider()).toBeInstanceOf(GoogleNewsRssSearchProvider);
  });

  it("retourne SerpApiSearchProvider si l'agent est activé ET une clé est présente", () => {
    process.env.RESEARCH_AGENT_ENABLED = "true";
    process.env.RESEARCH_SEARCH_API_KEY = "fake-key";
    expect(getSearchProvider()).toBeInstanceOf(SerpApiSearchProvider);
  });
});
