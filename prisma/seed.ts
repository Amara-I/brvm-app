// ═══════════════════════════════════════════════════════════════════════════
// Script de migration — COMPANIES_FULL (JSX) → base Prisma
// ═══════════════════════════════════════════════════════════════════════════
// Étape 2 du plan de migration.
//
// Principe : ce script est IDEMPOTENT (upsert partout) — on peut le relancer
// autant de fois que nécessaire sans dupliquer de données. Il transforme le
// tableau `COMPANIES_FULL` (voir prisma/seed-data/companies-full.ts, copie
// fidèle de reference/BRVM_Dashboard.jsx) en lignes Prisma, SANS PERTE :
//
//   - 1 ligne `Country`  par pays distinct (5 : Sénégal, Côte d'Ivoire,
//     Burkina Faso, Bénin, Niger)
//   - 1 ligne `Sector`   par secteur distinct (7 : Télécoms, Banques,
//     Divertissement, Conso. Base, Services Publics, Industrie, Énergie)
//   - 1 ligne `Company`  par société (20)
//   - 1 ligne `PriceHistory` par (société, année) où le cours JSX est > 0
//   - 1 ligne `Dividend`     par (société, année) où le dividende JSX est > 0
//   - 1 ligne `FinancialRatio` par société (PER + capitalisation "actuels")
//
// ⚠️ Choix de migration documentés :
//   1. Les valeurs à 0 dans `prices`/`dividends` du JSX signifient "société
//      pas encore cotée" ou "aucun dividende versé cette année-là" — elles
//      ne sont PAS insérées en base (absence de ligne = "N/D" côté API/UI,
//      cf. contrainte non négociable du footer JSX). Aucune perte
//      d'information : le calcul de `perf5`/`perf10`/etc. côté backend
//      (étape 5) devra reproduire la même logique de filtrage `> 0` que
//      `calcMetrics()` dans le JSX d'origine.
//   2. `per`/`mktcap` étaient des CONSTANTES globales dans le JSX (pas
//      d'historique par année). On les enregistre sur l'année de référence
//      la plus récente du jeu de données (2026) dans `financial_ratios`,
//      avec `source = MANUEL`. Les ingestions futures (étapes 3/6) pourront
//      compléter les années antérieures depuis brvm.org/Sikafinance/Richbourse.
//   3. Toutes les lignes créées ici portent `source = MANUEL` et
//      `isCanonical = true` : ce sont les données de référence historiques
//      fournies par l'utilisateur, en attendant que les connecteurs
//      d'ingestion (étape 3) les recoupent avec les sources officielles.
// ═══════════════════════════════════════════════════════════════════════════

import { PrismaClient, DataSource } from "@prisma/client";
import { COMPANIES_FULL, YEARS } from "./seed-data/companies-full";

const prisma = new PrismaClient();

/// Mapping pays (nom FR tel qu'utilisé dans le JSX) → code ISO 3166-1 alpha-2.
/// À compléter si de nouvelles sociétés d'autres pays UEMOA sont ajoutées
/// (ex: Mali "ML", Guinée-Bissau "GW", Togo "TG").
const COUNTRY_CODES: Record<string, string> = {
  "Sénégal": "SN",
  "Côte d'Ivoire": "CI",
  "Burkina Faso": "BF",
  "Bénin": "BJ",
  "Niger": "NE",
};

/// Dernière année du jeu de données JSX — sert d'année de référence pour le
/// PER/la capitalisation "actuels" (cf. choix de migration n°2 ci-dessus).
const CURRENT_REF_YEAR = YEARS[YEARS.length - 1];

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents (é, è, ...)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log(
    `🌱 Seed BRVM App — ${COMPANIES_FULL.length} sociétés, années ${YEARS[0]}-${YEARS[YEARS.length - 1]}`
  );

  // ── 1) Référentiels Pays & Secteurs (upsert, dédupliqués) ─────────────────
  const countryIdByName = new Map<string, string>();
  const sectorIdByName = new Map<string, string>();

  for (const co of COMPANIES_FULL) {
    if (!countryIdByName.has(co.country)) {
      const code = COUNTRY_CODES[co.country];
      if (!code) {
        throw new Error(
          `Code pays manquant pour "${co.country}" — complète COUNTRY_CODES dans prisma/seed.ts`
        );
      }
      const country = await prisma.country.upsert({
        where: { code },
        update: { name: co.country, flagEmoji: co.flag },
        create: { code, name: co.country, flagEmoji: co.flag },
      });
      countryIdByName.set(co.country, country.id);
    }

    if (!sectorIdByName.has(co.sector)) {
      const sector = await prisma.sector.upsert({
        where: { name: co.sector },
        update: { slug: slugify(co.sector) },
        create: { name: co.sector, slug: slugify(co.sector) },
      });
      sectorIdByName.set(co.sector, sector.id);
    }
  }
  console.log(`✔ ${countryIdByName.size} pays upsertés`);
  console.log(`✔ ${sectorIdByName.size} secteurs upsertés`);

  // ── 2) Sociétés + historique cours/dividendes/ratios ─────────────────────
  let priceRows = 0;
  let dividendRows = 0;
  let ratioRows = 0;
  let skippedZeroPrices = 0;
  let skippedZeroDividends = 0;

  for (const co of COMPANIES_FULL) {
    const countryId = countryIdByName.get(co.country)!;
    const sectorId = sectorIdByName.get(co.sector)!;

    const company = await prisma.company.upsert({
      where: { ticker: co.ticker },
      update: { name: co.name, color: co.color, countryId, sectorId },
      create: { ticker: co.ticker, name: co.name, color: co.color, countryId, sectorId },
    });

    for (const year of YEARS) {
      const price = co.prices[year];
      if (!price || price <= 0) {
        skippedZeroPrices++;
        continue;
      }
      await prisma.priceHistory.upsert({
        where: {
          uniq_price_company_date_source: {
            companyId: company.id,
            date: new Date(Date.UTC(year, 11, 31)),
            source: DataSource.MANUEL,
          },
        },
        update: { closePrice: price, isCanonical: true },
        create: {
          companyId: company.id,
          date: new Date(Date.UTC(year, 11, 31)),
          closePrice: price,
          source: DataSource.MANUEL,
          isCanonical: true,
        },
      });
      priceRows++;
    }

    for (const year of YEARS) {
      const amount = co.dividends[year];
      if (!amount || amount <= 0) {
        skippedZeroDividends++;
        continue;
      }
      await prisma.dividend.upsert({
        where: {
          uniq_dividend_company_year_source: { companyId: company.id, year, source: DataSource.MANUEL },
        },
        update: { amount, isCanonical: true },
        create: { companyId: company.id, year, amount, source: DataSource.MANUEL, isCanonical: true },
      });
      dividendRows++;
    }

    await prisma.financialRatio.upsert({
      where: {
        uniq_ratio_company_year_source: {
          companyId: company.id,
          year: CURRENT_REF_YEAR,
          source: DataSource.MANUEL,
        },
      },
      update: { per: co.per, mktCap: co.mktcap, isCanonical: true },
      create: {
        companyId: company.id,
        year: CURRENT_REF_YEAR,
        per: co.per,
        mktCap: co.mktcap,
        source: DataSource.MANUEL,
        isCanonical: true,
      },
    });
    ratioRows++;
  }

  console.log(`✔ ${COMPANIES_FULL.length} sociétés upsertées (table companies)`);
  console.log(`✔ ${priceRows} lignes de cours insérées (price_history) — ${skippedZeroPrices} années ignorées (cours = 0 dans le JSX)`);
  console.log(`✔ ${dividendRows} lignes de dividendes insérées (dividends) — ${skippedZeroDividends} années ignorées (dividende = 0 dans le JSX)`);
  console.log(`✔ ${ratioRows} lignes de ratios financiers insérées (financial_ratios, année de référence ${CURRENT_REF_YEAR})`);
  console.log("🌱 Seed terminé — aucune donnée de COMPANIES_FULL n'a été perdue.");
}

main()
  .catch((e) => {
    console.error("❌ Erreur pendant le seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
