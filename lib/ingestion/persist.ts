// ═══════════════════════════════════════════════════════════════════════════
// Persistance des résultats d'ingestion — étape 6 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Toutes les fonctions ci-dessous sont volontairement de simples fonctions
// Prisma paramétrées par le client (plutôt que d'importer le singleton
// `lib/prisma.ts` directement) : cela permet de les appeler aussi bien
// depuis l'orchestrateur (`run-full-ingestion.ts`) que depuis un futur test
// d'intégration avec une base de test dédiée.
//
// Principe de persistance (cf. AGENTS.md § priorité des sources) :
//   1. CHAQUE cotation brute (peu importe la source) est upsertée telle
//      quelle dans `price_history`/`market_index_values`, avec sa propre
//      ligne (clé unique companyId+date+source). Rien n'est perdu : même
//      les valeurs non retenues restent consultables pour audit.
//   2. La ligne correspondant à la source retenue par la réconciliation
//      (cf. reconciliation.ts) est ensuite marquée `isCanonical = true`,
//      après avoir démoté toute ancienne ligne canonique pour ce
//      (société, date) — garantit l'invariant "au plus une ligne canonique
//      par (société, date)" même si la source gagnante change d'un jour à
//      l'autre (ex: BRVM.org publie en retard un jour donné).
// ═══════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from "@prisma/client";
import { toPrismaDataSource } from "./prisma-mappers";
import type { DiscrepancyReport, ReconciledIndex, ReconciledPrice } from "./reconciliation";
import type { RawIndexQuote, RawPriceQuote } from "./types";

export interface PersistPricesResult {
  upserted: number;
  markedCanonical: number;
  unknownTickers: string[];
}

/// Upserte toutes les cotations brutes (`price_history`), puis marque la
/// valeur canonique retenue par la réconciliation. `companyIdByTicker` doit
/// couvrir tous les tickers actifs — un ticker inconnu (ex: nouvelle
/// introduction en bourse pas encore seedée) est ignoré et remonté dans
/// `unknownTickers` plutôt que de faire échouer tout le run.
export async function persistPriceQuotes(
  db: PrismaClient,
  allQuotes: RawPriceQuote[],
  reconciled: ReconciledPrice[],
  companyIdByTicker: Map<string, string>
): Promise<PersistPricesResult> {
  const unknownTickers = new Set<string>();
  let upserted = 0;

  for (const q of allQuotes) {
    const companyId = companyIdByTicker.get(q.ticker);
    if (!companyId) {
      unknownTickers.add(q.ticker);
      continue;
    }
    const date = new Date(`${q.date}T00:00:00.000Z`);
    const source = toPrismaDataSource(q.source);
    await db.priceHistory.upsert({
      where: { uniq_price_company_date_source: { companyId, date, source } },
      update: { closePrice: q.closePrice, volume: q.volume !== null ? BigInt(Math.round(q.volume)) : null, ingestedAt: new Date() },
      create: { companyId, date, source, closePrice: q.closePrice, volume: q.volume !== null ? BigInt(Math.round(q.volume)) : null },
    });
    upserted++;
  }

  let markedCanonical = 0;
  for (const r of reconciled) {
    const companyId = companyIdByTicker.get(r.ticker);
    if (!companyId) continue;
    const date = new Date(`${r.date}T00:00:00.000Z`);
    const winningSource = toPrismaDataSource(r.resolvedSource);
    await db.priceHistory.updateMany({ where: { companyId, date }, data: { isCanonical: false } });
    await db.priceHistory.update({
      where: { uniq_price_company_date_source: { companyId, date, source: winningSource } },
      data: { isCanonical: true },
    });
    markedCanonical++;
  }

  return { upserted, markedCanonical, unknownTickers: [...unknownTickers] };
}

export interface PersistIndicesResult {
  upserted: number;
  markedCanonical: number;
}

/// Upserte les indices eux-mêmes (`market_indices`, auto-créés au premier
/// passage à partir du libellé source) puis leurs valeurs quotidiennes
/// (`market_index_values`), avec la même logique canonique que les prix.
export async function persistIndexQuotes(
  db: PrismaClient,
  allQuotes: RawIndexQuote[],
  reconciled: ReconciledIndex[]
): Promise<PersistIndicesResult> {
  const labelByCode = new Map<string, string>();
  for (const q of allQuotes) if (!labelByCode.has(q.code)) labelByCode.set(q.code, q.label);

  const indexIdByCode = new Map<string, string>();
  for (const [code, label] of labelByCode) {
    const marketIndex = await db.marketIndex.upsert({ where: { code }, update: {}, create: { code, name: label } });
    indexIdByCode.set(code, marketIndex.id);
  }

  let upserted = 0;
  for (const q of allQuotes) {
    const marketIndexId = indexIdByCode.get(q.code);
    if (!marketIndexId) continue;
    const date = new Date(`${q.date}T00:00:00.000Z`);
    const source = toPrismaDataSource(q.source);
    await db.marketIndexValue.upsert({
      where: { uniq_index_date_source: { marketIndexId, date, source } },
      update: { value: q.value, changePercent: q.changePercent },
      create: { marketIndexId, date, value: q.value, changePercent: q.changePercent, source },
    });
    upserted++;
  }

  let markedCanonical = 0;
  for (const r of reconciled) {
    const marketIndexId = indexIdByCode.get(r.code);
    if (!marketIndexId) continue;
    const date = new Date(`${r.date}T00:00:00.000Z`);
    const winningSource = toPrismaDataSource(r.resolvedSource);
    await db.marketIndexValue.updateMany({ where: { marketIndexId, date }, data: { isCanonical: false } });
    await db.marketIndexValue.update({
      where: { uniq_index_date_source: { marketIndexId, date, source: winningSource } },
      data: { isCanonical: true },
    });
    markedCanonical++;
  }

  return { upserted, markedCanonical };
}

/// Journalise les écarts > seuil détectés par la réconciliation dans
/// `data_discrepancies`, pour audit manuel (cf. brief). Toujours marqué
/// `resolved: true` / `resolvedBy: null` car la règle de priorité des
/// sources tranche automatiquement — un humain peut rouvrir/contester via
/// l'interface admin (hors périmètre de cette étape) ou le script
/// `scripts/manual-correction.ts` (fallback manuel).
export async function persistDiscrepancies(
  db: PrismaClient,
  discrepancies: DiscrepancyReport[],
  companyIdByTicker: Map<string, string>,
  reconciled: ReconciledPrice[]
): Promise<number> {
  let inserted = 0;
  for (const d of discrepancies) {
    const companyId = companyIdByTicker.get(d.ticker);
    if (!companyId) continue;
    const winner = reconciled.find((r) => r.ticker === d.ticker && r.date === d.date);
    await db.dataDiscrepancy.create({
      data: {
        companyId,
        date: new Date(`${d.date}T00:00:00.000Z`),
        field: d.field,
        brvmValue: d.brvmValue,
        sikaValue: d.sikaValue,
        richValue: d.richValue,
        deltaPercent: d.deltaPercent,
        resolved: true,
        resolvedValue: winner?.closePrice ?? null,
        resolvedSource: winner ? toPrismaDataSource(winner.resolvedSource) : null,
        resolvedBy: null, // null = résolution automatique par la règle de priorité
      },
    });
    inserted++;
  }
  return inserted;
}
