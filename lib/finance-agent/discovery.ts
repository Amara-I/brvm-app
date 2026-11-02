import * as cheerio from "cheerio";
/** Recherche gratuite uniquement. Ne réutilise pas SerpAPI, dont l'abonnement est hors budget. */
export async function discoverFinancialSources(ticker: string, name: string, exchange: "BRVM" | "NGX", years: number[]) {
  const query = `${name} ${ticker} ${exchange} annual report financial results ${years.slice(-2).join(" ")}`;
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query); url.searchParams.set("hl", "fr"); url.searchParams.set("gl", "FR"); url.searchParams.set("ceid", "FR:fr");
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "error", headers: { "User-Agent": "OuestBourseFinancialResearch/1.0", Accept: "application/rss+xml" } });
  if (!res.ok) throw new Error("Recherche gratuite indisponible");
  const reader = res.body?.getReader(); if (!reader) return [];
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const r = await reader.read(); if (r.done) break; size += r.value.length;
    if (size > 500000) throw new Error("Flux de recherche trop volumineux"); chunks.push(r.value); } }
  finally { await reader.cancel().catch(() => undefined); }
  const xml = Buffer.concat(chunks).toString("utf8"); const $ = cheerio.load(xml, { xmlMode: true });
  return $("item").toArray().slice(0, 5).flatMap((el) => {
    const title = $(el).find("title").first().text().replace(/\s+/g, " ").trim().slice(0, 400);
    const link = $(el).find("link").first().text().trim();
    try { const u = new URL(link); if (u.protocol !== "https:" || u.username || u.password) return [];
      // Liens de découverte seulement : ils ne seront jamais téléchargés automatiquement par le lecteur IA.
      return title ? [{ query, title, url: u.href, summary: "PISTE NON VALIDÉE — vérifier la source originale et la date ; aucun chiffre importé." }] : []; } catch { return []; }
  });
}
