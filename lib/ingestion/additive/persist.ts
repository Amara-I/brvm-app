// Ce chemin NE réutilise PAS les upserts de rafraîchissement : aucune valeur existante n'est modifiée.
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { RawPriceQuote } from "../types";
import { sourceRank } from "../reconciliation";
export interface Publication {
  ticker: string | null; exchange: "BRVM" | "NGX"; title: string; url: string;
  publishedAt: string | null; sourceName: string; docType: string; periodLabel: string | null;
}
export interface PriceConflict { companyId: string; date: string; source: string; existingSource: string; incoming: number; existing: number; deltaPercent: number }
export function priceInsertPlan(incoming: RawPriceQuote[], existing: { companyId: string; date: Date; source: string; closePrice: unknown; isCanonical: boolean }[], ids: Map<string, string>) {
  const seen = new Set(existing.map((r) => `${r.companyId}|${r.date.toISOString().slice(0, 10)}|${r.source}`));
  const occupied = new Set(existing.map((r) => `${r.companyId}|${r.date.toISOString().slice(0, 10)}`));
  const data = []; const conflicts: PriceConflict[] = [];
  const valid = [...incoming].filter((q) => ids.has(q.ticker) && Number.isFinite(q.closePrice) && q.closePrice > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(q.date) && Number.isFinite(Date.parse(q.date)) && new Date(q.date).toISOString().slice(0, 10) === q.date && Number.isFinite(Date.parse(q.fetchedAt)) && q.date <= new Date().toISOString().slice(0, 10))
    .sort((a, b) => sourceRank(a.source) - sourceRank(b.source));
  for (const q of valid) {
    const companyId = ids.get(q.ticker)!; const pair = `${companyId}|${q.date}`; const key = `${pair}|${q.source}`;
    for (const old of existing.filter((r) => r.companyId === companyId && r.date.toISOString().slice(0, 10) === q.date)) {
      const value = Number(old.closePrice); const delta = value > 0 ? Math.abs(q.closePrice - value) / value * 100 : 0;
      if (delta > 2) conflicts.push({ companyId, date: q.date, source: q.source, existingSource: old.source, incoming: q.closePrice, existing: value, deltaPercent: delta });
    }
    if (seen.has(key)) continue;
    data.push({ companyId, date: new Date(`${q.date}T00:00:00Z`), source: q.source, closePrice: q.closePrice,
      volume: q.volume != null && Number.isFinite(q.volume) && q.volume >= 0 ? q.volume : null,
      changePercent: q.changePercent ?? null, ingestedAt: new Date(q.fetchedAt), isCanonical: !occupied.has(pair) });
    seen.add(key); occupied.add(pair);
  }
  return { data, conflicts };
}

export async function appendPrices(db: PrismaClient, quotes: RawPriceQuote[], ids: Map<string, string>, apply: boolean) {
  if (!quotes.length) return { inserted: 0, candidates: 0, conflicts: [] as PriceConflict[] };
  return db.$transaction(async (tx) => {
    // Verrou court partagé avec les écritures SQL normales : la lecture des canoniques et l'insertion sont atomiques.
    // Pas de fetch réseau sous verrou, ni de suppression/démotion de canonique existant.
    if (apply) await tx.$executeRawUnsafe('LOCK TABLE "price_history" IN SHARE ROW EXCLUSIVE MODE');
    const existing = await tx.priceHistory.findMany({ where: { companyId: { in: [...ids.values()] },
      date: { in: [...new Set(quotes.map((q) => q.date))].map((d) => new Date(`${d}T00:00:00Z`)) } },
      select: { companyId: true, date: true, source: true, closePrice: true, isCanonical: true } });
    const plan = priceInsertPlan(quotes, existing, ids);
    const inserted = apply && plan.data.length ? (await tx.priceHistory.createMany({ data: plan.data, skipDuplicates: true })).count : 0;
    if (apply) for (const c of plan.conflicts) {
      const date = new Date(`${c.date}T00:00:00Z`);
      const field = `close_price:${c.source}:${c.existingSource}`;
      if (await tx.dataDiscrepancy.findFirst({ where: { companyId: c.companyId, date, field, resolved: false } })) continue;
      await tx.dataDiscrepancy.create({ data: { companyId: c.companyId, date, field, resolved: false,
        deltaPercent: Math.min(9999.99, Math.round(c.deltaPercent * 100) / 100),
        brvmValue: c.source === "BRVM_OFFICIEL" ? c.incoming : c.existingSource === "BRVM_OFFICIEL" ? c.existing : null,
        sikaValue: c.source === "SIKAFINANCE" ? c.incoming : c.existingSource === "SIKAFINANCE" ? c.existing : null,
        richValue: c.source === "RICHBOURSE" ? c.incoming : c.existingSource === "RICHBOURSE" ? c.existing : null } });
    }
    return { inserted, candidates: plan.data.length, conflicts: plan.conflicts };
  }, { timeout: 20000 });
}

export async function appendPublications(db: PrismaClient, rows: Publication[], ids: Map<string, string>, apply: boolean) {
  let documents = 0; let news = 0; let candidates = 0; let undated = 0;
  for (const row of rows) {
    const companyId = row.ticker ? ids.get(row.ticker) : null;
    // Pas de réassociation approximative. Les documents sans société sûre sont gardés dans le rapport de collecte uniquement.
    if (companyId && !await db.companyDocument.findUnique({ where: { companyId_url: { companyId, url: row.url } } })) {
      candidates++;
      if (apply) documents += (await db.companyDocument.createMany({ skipDuplicates: true, data: [{ companyId, url: row.url,
        title: row.title, docType: row.docType, periodLabel: row.periodLabel, sourceName: row.sourceName,
        publishedAt: row.publishedAt ? new Date(row.publishedAt) : null }] })).count;
    }
    // Une date de collecte n'est jamais présentée comme une date de publication.
    if (!row.publishedAt) { undated++; continue; }
    const slug = `official-${createHash("sha256").update(row.url).digest("hex").slice(0, 40)}`;
    if (await db.newsArticle.findFirst({ where: { OR: [{ url: row.url }, { slug }] } })) continue;
    candidates++;
    if (apply) news += (await db.newsArticle.createMany({ skipDuplicates: true, data: [{ slug, title: row.title,
      url: row.url, companyId: companyId ?? null, sourceName: `${row.exchange} · ${row.sourceName}`,
      publishedAt: new Date(row.publishedAt) }] })).count;
  }
  return { documents, news, candidates, undated };
}
