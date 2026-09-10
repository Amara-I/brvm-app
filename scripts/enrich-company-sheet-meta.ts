// Enrichit fiches sociétés : profil Sika + détails/actionnariat OB + news/events Sika + documents BRVM (via OB).
// Usage :
//   npm run enrich:company-meta
//   npx ts-node scripts/enrich-company-sheet-meta.ts SNTS SGBC
//
// Notes :
// - Sikafinance /docs/* est interdit par robots.txt → documents via catalogue OB (PDF brvm.org).
// - Détails émetteur (industrie, DG, présidence, IPO, site) : `brvm_company_profiles` OB.
// - Historique cours déjà couvert par GetHistos / OB (pas de scrape HTML historiques).

import { prisma } from "../lib/prisma";
import { sikafinanceConnector } from "../lib/ingestion/connectors/sikafinance_connector";
import {
  fetchOuestbourseCompanyProfile,
  fetchOuestbourseDocuments,
  fetchOuestbourseShareholders,
  isOuestbourseSupabaseConfigured,
  obCompanyProfileToRaw,
  obDocumentsToRaw,
  obShareholdersToProfilePatch,
} from "../lib/ingestion/connectors/ouestbourse_supabase";
import {
  persistCompanyDocuments,
  persistCompanyEvents,
  persistCompanyNews,
  persistCompanyProfiles,
  persistDividendRows,
  persistFinancialRatios,
} from "../lib/ingestion/persist";
import type { RawCompanyProfile } from "../lib/ingestion/types";

async function main() {
  const only = process.argv.slice(2).map((t) => t.toUpperCase());
  const companies = await prisma.company.findMany({
    where: { isActive: true, ...(only.length ? { ticker: { in: only } } : {}) },
    select: { id: true, ticker: true },
    orderBy: { ticker: "asc" },
  });
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));
  const obOk = isOuestbourseSupabaseConfigured();

  console.log(
    `→ Méta fiches — ${companies.length} société(s)` +
      ` · OB profils/docs/actionnariat=${obOk ? "oui" : "non (clé absente)"}`
  );

  let ok = 0;
  let fail = 0;

  for (const co of companies) {
    const parts: string[] = [];
    try {
      // 1) Profil + fondamentaux Sikafinance SOCIETE
      const sheet = await sikafinanceConnector.fetchCompanySheet(co.ticker);
      if (sheet.ok) {
        const { profile, fundamentals, dividends } = sheet.data;
        await persistCompanyProfiles(prisma, [profile], companyIdByTicker);
        await persistFinancialRatios(prisma, fundamentals, companyIdByTicker);
        await persistDividendRows(prisma, dividends, companyIdByTicker);
        parts.push(`sikaProfil(actionnaires=${profile.shareholders.length})`);
      } else {
        parts.push(`sikaProfil✗ ${sheet.error}`);
      }

      // 2) Détails émetteur + actionnariat + documents OB
      if (obOk) {
        try {
          const obProfile = await fetchOuestbourseCompanyProfile(co.ticker);
          if (obProfile) {
            const raw = obCompanyProfileToRaw(co.ticker, obProfile);
            await persistCompanyProfiles(prisma, [raw], companyIdByTicker);
            parts.push(
              `obDétails(${[
                obProfile.industry ? "ind" : null,
                obProfile.ceo ? "dg" : null,
                obProfile.chairman ? "prés" : null,
                obProfile.listing_date ? "ipo" : null,
                obProfile.website ? "web" : null,
              ]
                .filter(Boolean)
                .join("+") || "vide"})`
            );
          } else {
            parts.push("obDétails=∅");
          }
        } catch (e) {
          parts.push(`obDétails✗ ${e instanceof Error ? e.message : String(e)}`);
        }

        try {
          const sh = await fetchOuestbourseShareholders(co.ticker);
          const patch = obShareholdersToProfilePatch(sh);
          if (patch) {
            const existing = await prisma.company.findUnique({
              where: { id: co.id },
              select: { profileMeta: true, isin: true, description: true },
            });
            const prev = (existing?.profileMeta as Record<string, unknown> | null) ?? {};
            const prevSh = Array.isArray(prev.shareholders) ? prev.shareholders : [];
            const needFill = prevSh.length < 2 || patch.shareholders.length > prevSh.length;
            if (needFill || !(prev as { shareholdersAsOf?: string }).shareholdersAsOf) {
              const merged: RawCompanyProfile = {
                ticker: co.ticker,
                isin: null,
                description: null,
                sharesOutstanding: null,
                floatPercent: patch.floatPercent,
                phone: null,
                fax: null,
                address: null,
                directors: null,
                valuationLabel: null,
                shareholders: patch.shareholders,
                shareholdersAsOf: patch.shareholdersAsOf,
                source: "OUESTBOURSE",
                fetchedAt: patch.fetchedAt,
              };
              await persistCompanyProfiles(prisma, [merged], companyIdByTicker);
              parts.push(`obActionnaires=${patch.shareholders.length}`);
            }
          }
        } catch (e) {
          parts.push(`obActionnaires✗ ${e instanceof Error ? e.message : String(e)}`);
        }

        try {
          const docs = await fetchOuestbourseDocuments(co.ticker);
          const raw = obDocumentsToRaw(co.ticker, docs);
          const r = await persistCompanyDocuments(prisma, raw, companyIdByTicker);
          parts.push(`docs=${r.upserted}`);
        } catch (e) {
          parts.push(`docs✗ ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // 3) News + events Sikafinance
      const news = await sikafinanceConnector.fetchCompanyNews(co.ticker);
      if (news.ok) {
        const r = await persistCompanyNews(prisma, news.data, companyIdByTicker);
        parts.push(`news=${r.upserted}`);
      } else {
        parts.push(`news✗`);
      }

      const events = await sikafinanceConnector.fetchCompanyEvents(co.ticker);
      if (events.ok) {
        const r = await persistCompanyEvents(prisma, events.data, companyIdByTicker);
        parts.push(`events=${r.upserted}`);
      } else {
        parts.push(`events✗`);
      }

      ok++;
      console.log(`  ${co.ticker}: ${parts.join(" · ")}`);
    } catch (e) {
      fail++;
      console.warn(`  ${co.ticker}: ÉCHEC ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`✔ OK=${ok} échecs=${fail}`);
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
