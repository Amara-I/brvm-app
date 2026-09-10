// ═══════════════════════════════════════════════════════════════════════════
// Fournisseur de recherche — Google News RSS (sans clé API)
// ═══════════════════════════════════════════════════════════════════════════
// Remplace DuckDuckGo HTML en local : DDG renvoie un challenge anti-bot
// ("Unfortunately, bots use DuckDuckGo too"). Le flux RSS public de Google
// News accepte des GET simples et suffit pour une veille best-effort.
// SerpAPI reste le provider recommandé dès qu'une clé est configurée.
// ═══════════════════════════════════════════════════════════════════════════

import * as cheerio from "cheerio";
import type { RawSearchResult, SearchProvider } from "../types";

export class GoogleNewsRssSearchProvider implements SearchProvider {
  readonly id = "google-news-rss";

  async search(query: string): Promise<RawSearchResult[]> {
    const url = new URL("https://news.google.com/rss/search");
    url.searchParams.set("q", query);
    url.searchParams.set("hl", "fr");
    url.searchParams.set("gl", "FR");
    url.searchParams.set("ceid", "FR:fr");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          process.env.INGESTION_USER_AGENT ??
          "BRVMAppResearchBot/1.0 (+https://brvm-app.vercel.app; contact: admin@brvm-app.example)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (!res.ok) {
      throw new Error(`Google News RSS a répondu ${res.status} pour "${query}"`);
    }

    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const results: RawSearchResult[] = [];

    $("item").each((_, el) => {
      if (results.length >= 8) return false;
      const title = $(el).find("title").first().text().replace(/\s+/g, " ").trim();
      const link = $(el).find("link").first().text().trim();
      const snippet = $(el).find("description").first().text().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!title || !link) return;
      results.push({ title, url: link, snippet: snippet || undefined });
    });

    return results;
  }
}
