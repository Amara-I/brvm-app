import * as cheerio from "cheerio";
import { fetchHtml, fetchJson } from "../http-client";
import { normalizeIssuerLabel, buildBrvmIssuerResolver } from "../brvm-issuer-ticker";
import { buildListUrl, classifyDocument } from "@/lib/ngx/fundamentals/discover";
import type { NgxListItem } from "@/lib/ngx/fundamentals/types";
import { NGX_TICKER_ALIASES } from "../ngx/ticker-aliases";
import type { Publication } from "./persist";

export const BRVM_DIRECTORY = "https://www.brvm.org/fr/rapports-societes-cotees";
export const BRVM_RELEASES = "https://www.brvm.org/fr/emetteurs/type-annonces/communiques";
const BRVM = "https://www.brvm.org";
const NGX = "https://doclib.ngxgroup.com";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export function officialUrl(href: string, base: string, host: string): string | null {
  try { const url = new URL(href, base); return url.protocol === "https:" && url.hostname === host && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function publishedDate(text: string): string | null {
  const m = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`; const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}
export function nextBrvmPage(html: string, base: string): string | null {
  const $ = cheerio.load(html);
  const href = $("li.pager-next a, a[rel='next']").first().attr("href");
  return href ? officialUrl(href, base, "www.brvm.org") : null;
}

/** Titres officiels publiés dans les tableaux : ne jamais récupérer les bandeaux de cours comme nouvelles. */
export function parseBrvmPublications(html: string, pageUrl: string, ticker: string | null,
  resolve: (label: string) => string | null): Publication[] {
  const $ = cheerio.load(html); const out = new Map<string, Publication>();
  $("table tbody tr").each((_, tr) => {
    const cells = $(tr).find("td"); const rowText = clean($(tr).text());
    const titleLink = $(tr).find("a").filter((_, a) => {
      const title = clean($(a).text());
      return /rapport|financier|résultat|resultat|communiqu|assembl|dividende|profit.warning|annual/i.test(title);
    }).first();
    const title = clean(titleLink.text());
    if (!title) return;
    const href = $(tr).find("a[href]").filter((_, a) => /\.pdf(?:\?|$)/i.test($(a).attr("href") ?? "")).first().attr("href") ?? titleLink.attr("href");
    const url = href ? officialUrl(href, pageUrl, "www.brvm.org") : null;
    if (!url) return;
    const issuer = clean(cells.eq(1).text());
    // Même dans une page d'émetteur, une ligne étiquetée avec un autre émetteur n'est pas réattribuée.
    const titleIssuer = clean(title.split(":")[0] ?? "");
    const resolved = resolve(issuer) ?? resolve(titleIssuer);
    if (ticker && ((resolved && resolved !== ticker) || (title.includes(":") && !resolved))) return;
    const period = title.match(/(?:exercice|annuel|annual|FY)\s*[-:]?\s*(20\d{2})/i)?.[1] ?? null;
    out.set(url, { ticker: resolved ?? ticker, exchange: "BRVM", title, url, publishedAt: publishedDate(rowText),
      sourceName: "BRVM officiel", docType: /communiqu/i.test(title) ? "COMMUNIQUE" : "RAPPORT", periodLabel: period });
  });
  return [...out.values()];
}

function resolver(companies: { ticker: string; name: string }[]) {
  const base = buildBrvmIssuerResolver(companies);
  // Libellés du répertoire officiel (pas une recherche approximative par sous-chaîne).
  const aliases: Record<string, string> = { SONATEL: "SNTS", "SONATEL SN": "SNTS", "SONATEL SENEGAL": "SNTS",
    "ONTBF": "ONTBF", "ONATEL BF": "ONTBF", "ONATEL": "ONTBF",
    "ECOBANK TG": "ETIT", "ETI TG": "ETIT", "BANK OF AFRICA BF": "BOABF", "BANK OF AFRICA BN": "BOAB",
    "BANK OF AFRICA CI": "BOAC", "BANK OF AFRICA ML": "BOAM", "BANK OF AFRICA NG": "BOAN", "BANK OF AFRICA SN": "BOAS",
    BBGCI: "BBGC", BIIC: "BICB", "AIR LIQUIDE CI": "SIVC", "BOLLORE TRANSPORT LOGISTICS": "SDSC" };
  const known = new Set(companies.map((c) => c.ticker));
  return (s: string) => { const t = base(s) ?? aliases[normalizeIssuerLabel(s)] ?? null; return t && known.has(t) ? t : null; };
}

export async function collectBrvmPublications(companies: { ticker: string; name: string }[], ticker: string | null): Promise<Publication[]> {
  const resolve = resolver(companies); let url: string | null = ticker ? BRVM_DIRECTORY : BRVM_RELEASES;
  let issuerUrl: string | null = null; const visited = new Set<string>(); const out: Publication[] = [];
  // Suit la pagination publiée, sans fabriquer de slug société.
  while (url) {
    if (visited.has(url) || visited.size >= 30) throw new Error("Pagination BRVM incomplète (boucle/plafond) ; relancer après diagnostic");
    visited.add(url);
    const html = await fetchHtml(url, { cacheTtlMs: 6 * 3600000, checkRobots: true });
    if (ticker && !issuerUrl) {
      const $ = cheerio.load(html);
      $("table tbody tr").each((_, tr) => {
        $(tr).find("a[href]").each((_, a) => {
          if (resolve(clean($(a).text())) !== ticker) return;
          const href = officialUrl($(a).attr("href")!, url!, "www.brvm.org");
          if (href && /\/rapports-societe-cotes\//.test(href)) issuerUrl = href;
        });
      });
      if (issuerUrl) { url = issuerUrl; continue; }
    } else out.push(...parseBrvmPublications(html, url, ticker, resolve));
    url = nextBrvmPage(html, url);
  }
  if (ticker && !issuerUrl) throw new Error(`Aucun appariement officiel BRVM pour ${ticker} — aucun rattachement inventé`);
  return [...new Map(out.map((r) => [r.url, r])).values()];
}

export function parseNgxPublications(items: NgxListItem[], ticker: string): Publication[] {
  return items.flatMap((item) => {
    const url = item.URL?.Url ? officialUrl(item.URL.Url, NGX, "doclib.ngxgroup.com") : null;
    const title = clean(item.URL?.Description ?? "");
    if (!url || !title) return [];
    const date = new Date(item.Created);
    return [{ ticker, exchange: "NGX" as const, title, url,
      publishedAt: Number.isFinite(date.getTime()) ? date.toISOString() : null,
      sourceName: "NGX officiel", docType: classifyDocument(item) ?? "COMMUNIQUE",
      // La date de dépôt n'est PAS l'exercice comptable ; aucune déduction hasardeuse.
      periodLabel: title.match(/(?:FY|EXERCISE|YEAR ENDED|ANNUAL REPORT)\s*[-:]?\s*(20\d{2})/i)?.[1] ?? null }];
  });
}
export async function collectNgxPublications(ticker: string): Promise<Publication[]> {
  const symbols = [ticker, ...NGX_TICKER_ALIASES.filter((a) => a.current === ticker).map((a) => a.old)];
  const out: Publication[] = [];
  for (const symbol of symbols) {
    let url: string | null = buildListUrl(symbol); const visited = new Set<string>();
    while (url) {
      if (visited.has(url) || visited.size >= 30) throw new Error("Pagination NGX incomplète");
      visited.add(url);
      const json: { value?: NgxListItem[]; "odata.nextLink"?: string; d?: { results?: NgxListItem[]; __next?: string } } = await fetchJson(`${url}${url.includes("?") ? "&" : "?"}$format=json`, { cacheTtlMs: 3600000, checkRobots: true });
      const items = json.d?.results ?? json.value;
      if (!Array.isArray(items)) throw new Error("Format NGX XFinancial_News inattendu");
      out.push(...parseNgxPublications(items.filter((item) => !item.CompanySymbol || item.CompanySymbol.trim().toUpperCase() === symbol), ticker));
      const next = json.d?.__next ?? json["odata.nextLink"];
      url = next ? officialUrl(next, url, "doclib.ngxgroup.com") : null;
      if (next && !url) throw new Error("Continuation NGX hors domaine refusée");
    }
  }
  return [...new Map(out.map((r) => [r.url, r])).values()];
}
