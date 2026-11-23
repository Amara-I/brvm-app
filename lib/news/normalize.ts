// Normalisation des actualités ingérées (logique pure, testée).
// On ne stocke que le titre, le lien et la source : jamais le contenu de l'article.

import { createHash } from "node:crypto";

const MAX_TITLE = 300;

export function cleanNewsTitle(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 1).trimEnd()}…` : t;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Slug stable et unique : une même actualité reste dédoublonnée d'un passage à l'autre. */
export function newsSlug(ticker: string, url: string): string {
  const hash = createHash("sha1").update(url.trim()).digest("hex").slice(0, 12);
  return `${ticker.toLowerCase()}-${hash}`;
}

export type NewsRow = {
  title: string;
  slug: string;
  url: string;
  sourceName: string;
  companyId: string;
  publishedAt: Date;
};

/**
 * Prépare les lignes à insérer. La source n'indique pas la date de publication :
 * `publishedAt` = date de première collecte (affichée telle quelle dans l'UI).
 */
export function toNewsRows(
  company: { id: string; ticker: string },
  items: Array<{ title: string; url: string; sourceName: string; publishedAt: string | null }>,
  now: Date
): NewsRow[] {
  const seen = new Set<string>();
  const rows: NewsRow[] = [];
  for (const item of items) {
    const title = cleanNewsTitle(item.title);
    if (title.length < 10 || !isHttpUrl(item.url)) continue;
    const slug = newsSlug(company.ticker, item.url);
    if (seen.has(slug)) continue;
    seen.add(slug);
    const parsed = item.publishedAt ? new Date(item.publishedAt) : null;
    rows.push({
      title,
      slug,
      url: item.url.trim(),
      sourceName: item.sourceName || "Sikafinance",
      companyId: company.id,
      publishedAt: parsed && !Number.isNaN(parsed.getTime()) && parsed <= now ? parsed : now,
    });
  }
  return rows;
}
