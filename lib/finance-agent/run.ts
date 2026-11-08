import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { collectBrvmPublications, collectNgxPublications } from "@/lib/ingestion/additive/publications";
import { appendPublications } from "@/lib/ingestion/additive/persist";
import { runWithFetchDeadline } from "@/lib/ingestion/fetch-budget";
import { listingCoverage } from "@/lib/markets/coverage";
import { costEnvelope, reservationCents, reserveBudget, MONTHLY_LIMIT_CENTS } from "./budget";
import { financialPages, trustedDocumentUrl } from "./document";
import { discoverFinancialSources } from "./discovery";
import { checkedObservations, EXTRACTION_SYSTEM, proposalSchema } from "./proposal";

export const AGENT_PROVIDER = "finance-agent-review-v1";
export const AGENT_LOG = "FINANCE_AGENT_RUN_V1";
const MAX_OUTPUT_TOKENS = 1800;

export async function runFinanceAgent(db: PrismaClient = prisma, options?: { deadlineMs?: number }) {
  const result = { enabled: process.env.FINANCE_AGENT_ENABLED === "true", monthlyLimitEur: MONTHLY_LIMIT_CENTS / 100,
    ticker: null as string | null, exchange: null as string | null, missingYears: [] as number[], discovered: 0, proposals: 0, documentsAdded: 0, newsAdded: 0,
    reservedCents: 0, aiStatus: "NOT_REQUESTED", errors: [] as string[] };
  const left = () => (options?.deadlineMs ?? Number.POSITIVE_INFINITY) - Date.now();
  // Sans délai (route manuelle) : illimité ici, le maxDuration de la route borne l'appel.
  // Avec délai (cron de 17:00) : on s'arrête avant l'IA plutôt que de dépasser le budget du jour.
  if (!result.enabled) return result;
  if (left() < 5_000) { result.aiStatus = "SKIPPED_TIME_BUDGET"; return result; }
  const companies = await db.company.findMany({ where: { isActive: true, exchange: { in: ["BRVM", "NGX"] } },
    select: { id: true, ticker: true, name: true, exchange: true, financialRatios: {
      where: { isCanonical: true, year: { gte: new Date().getUTCFullYear() - 10, lt: new Date().getUTCFullYear() } },
      select: { year: true, revenue: true, operatingIncome: true, netIncome: true } } }, orderBy: [{ exchange: "asc" }, { ticker: "asc" }] });
  const missing = companies.map((c) => ({ ...c, missing: listingCoverage({ ticker: c.ticker, exchange: c.exchange as "BRVM" | "NGX",
    firstDate: null, lastDate: null, priceCount: 0, financials: c.financialRatios }).missingFinancialYears })).filter((c) => c.missing.length);
  const brvm = missing.filter((c) => c.exchange === "BRVM"); const ngx = missing.filter((c) => c.exchange === "NGX");
  const gaps = Array.from({ length: Math.max(brvm.length, ngx.length) }, (_, i) => [brvm[i], ngx[i]]).flat().filter((c): c is typeof missing[number] => !!c);
  if (!gaps.length) return { ...result, aiStatus: "NO_ACCOUNT_GAPS" };
  // Tourniquet persistant : une seule société et un seul document par invocation ; la BRVM ne monopolise pas la file.
  const recent = await db.ingestionLog.findMany({ where: { source: "MANUEL" }, orderBy: { runAt: "desc" }, take: 100, select: { errors: true } });
  const previous = recent.map((r) => r.errors as { kind?: string; lastCompanyId?: string } | null).find((p) => p?.kind === AGENT_LOG);
  const prevIndex = gaps.findIndex((c) => c.id === previous?.lastCompanyId);
  const company = gaps[(prevIndex + 1) % gaps.length]; const exchange = company.exchange as "BRVM" | "NGX";
  result.ticker = company.ticker; result.exchange = exchange; result.missingYears = company.missing;
  if (process.env.FINANCE_AGENT_CATALOG_ENABLED === "true" && left() >= 8_000) {
    try {
      const catalogDeadline = Math.min(Date.now() + 45_000, options?.deadlineMs ?? Date.now() + 45_000);
      const rows = await runWithFetchDeadline(catalogDeadline, () => exchange === "NGX" ? collectNgxPublications(company.ticker) :
        collectBrvmPublications(companies.filter((c) => c.exchange === "BRVM"), company.ticker));
      const known = await db.companyDocument.findMany({ where: { companyId: company.id }, select: { url: true } });
      const urls = new Set(known.map((r) => r.url));
      const valid = rows.filter((r) => !r.publishedAt || (Number.isFinite(Date.parse(r.publishedAt)) && r.publishedAt.slice(0, 10) <= new Date().toISOString().slice(0, 10)));
      const added = await appendPublications(db, valid.filter((r) => !urls.has(r.url)).slice(0, 20), new Map([[company.ticker, company.id]]), true);
      result.documentsAdded = added.documents; result.newsAdded = added.news;
    } catch { result.errors.push("Catalogue officiel incomplet ou inaccessible ; aucun écrasement"); }
  }
  if (left() < 3_000) { result.aiStatus = "SKIPPED_TIME_BUDGET"; return result; }
  try {
    const sources = await discoverFinancialSources(company.ticker, company.name, exchange, company.missing);
    for (const s of sources) {
      const inserted = await db.researchFinding.createMany({ skipDuplicates: true, data: [{ ...s, category: "CONTENU", provider: AGENT_PROVIDER }] });
      result.discovered += inserted.count;
    }
  } catch { result.errors.push("Recherche gratuite indisponible ; pas de bascule payante"); }
  if (left() < 20_000) { result.aiStatus = "SKIPPED_TIME_BUDGET"; return result; }
  const price = costEnvelope();
  if (!price || process.env.FINANCE_AGENT_AI_ENABLED !== "true") result.aiStatus = "BLOCKED_UNVERIFIED_COST_OR_PROVIDER_CAP";
  else {
    const documents = await db.companyDocument.findMany({ where: { companyId: company.id, docType: { in: ["AUDITED_FS", "ANNUAL_REPORT", "RAPPORT", "Etats Financiers"] } },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: 60,
      select: { id: true, title: true, url: true, publishedAt: true, sourceName: true } });
    let selected = false;
    for (const doc of documents) {
      if (!trustedDocumentUrl(doc.url, exchange)) continue;
      const hash = createHash("sha256").update(`${doc.url}|${company.missing.join(",")}`).digest("hex").slice(0, 24);
      const proposalUrl = `${doc.url}#ob-finance-review-${hash}`;
      if (await db.researchFinding.findUnique({ where: { url: proposalUrl }, select: { id: true } })) continue;
      selected = true;
      try {
        const pages = await financialPages(doc.url, exchange);
        if (!pages.length) { result.aiStatus = "NO_SELECTABLE_TEXT"; break; }
        const prompt = JSON.stringify({ ticker: company.ticker, companyName: company.name, exchange, missingYears: company.missing,
          sourceUrl: doc.url, publicationDate: doc.publishedAt?.toISOString() ?? null, pages });
        if (Buffer.byteLength(prompt) > 60000) throw new Error("Entrée IA trop volumineuse");
        // Aucun appel dans la dernière minute du mois : la réservation doit couvrir la même période de facture.
        const now = new Date(); const rollover = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
        if (rollover - now.getTime() < 60000) { result.aiStatus = "MONTH_ROLLOVER_PAUSE"; break; }
        const cents = reservationCents(Buffer.byteLength(prompt + EXTRACTION_SYSTEM), MAX_OUTPUT_TOKENS, price);
        if (!await reserveBudget(db, cents, `${company.id}:${hash}`)) { result.aiStatus = "MONTHLY_CAP_REACHED"; break; }
        result.reservedCents = cents; // Jamais remboursé, même sur timeout/erreur : pas de fuite de budget.
        const { generateText, gateway, Output } = await import("ai");
        const generation = await generateText({ model: gateway(price.model), system: EXTRACTION_SYSTEM, prompt,
          output: Output.object({ schema: proposalSchema }), maxOutputTokens: MAX_OUTPUT_TOKENS,
          maxRetries: 0, timeout: 25000, providerOptions: { gateway: { only: [price.provider], tags: ["ouestbourse-finance-agent"] } } });
        const proposal = proposalSchema.parse(generation.output);
        const observations = checkedObservations(proposal, pages, company.missing);
        await db.researchFinding.createMany({ skipDuplicates: true, data: [{ category: "CONTENU", provider: AGENT_PROVIDER,
          title: `${exchange} · ${company.ticker} — ${observations.length} observations à valider`,
          query: `financial-gaps:${exchange}:${company.ticker}`, url: proposalUrl,
          summary: JSON.stringify({ version: 1, status: "PENDING_HUMAN_REVIEW", companyId: company.id, ticker: company.ticker,
            exchange, sourceUrl: doc.url, sourceName: doc.sourceName, collectedAt: new Date().toISOString(),
            model: price.model, reservedCents: cents, observations, rejectedObservations: proposal.observations.length - observations.length }) }] });
        result.proposals = observations.length; result.aiStatus = "PENDING_HUMAN_REVIEW";
      } catch { result.aiStatus = "FAILED_CLOSED_RESERVATION_RETAINED"; result.errors.push("Lecture/extraction non validée ; aucun chiffre publié"); }
      break;
    }
    if (!selected) result.aiStatus = "NO_NEW_TRUSTED_DOCUMENT";
  }
  await db.ingestionLog.create({ data: { source: "MANUEL", status: result.errors.length ? "PARTIAL" : "SUCCESS", finishedAt: new Date(),
    errors: { ...result, kind: AGENT_LOG, lastCompanyId: company.id } as unknown as Prisma.InputJsonValue } });
  return result;
}
