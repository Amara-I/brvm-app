// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/ingest — Point d'entrée du cron d'ingestion, étape 6
// ═══════════════════════════════════════════════════════════════════════════
// Déclenché quotidiennement par Vercel Cron (cf. vercel.json) après la
// clôture de la BRVM (~15h15 GMT = heure d'Abidjan/Dakar/Ouaga, marché
// fermé à cette heure). Vercel Cron ajoute automatiquement l'en-tête
// `Authorization: Bearer ${CRON_SECRET}` aux requêtes programmées — on le
// vérifie ici pour empêcher quiconque de déclencher un run d'ingestion en
// tapant simplement l'URL dans un navigateur.
//
// Peut aussi être appelé manuellement (tests, rattrapage après incident) en
// fournissant le même secret via `?secret=` ou l'en-tête Authorization.
//
// Le même appel enchaîne, en best-effort, l'agent financier et le lot
// quotidien d'historique/publications BRVM et NGX. Le plan Hobby n'a que
// deux crons : ces travaux ne peuvent plus avoir leur propre entrée dans
// vercel.json. Les routes `/api/cron/finance-agent` et
// `/api/cron/enrich-history` restent appelables à la main.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { dailyIngestBudgetMs, runDailyAfterClose, type DailyFollowUpSummary } from "@/lib/cron/daily-follow-up";
import { runFullIngestion } from "@/lib/ingestion/run-full-ingestion";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";
import { isCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Hobby (Fluid) coupe la fonction à 300s — « Task timed out after 300 seconds » —
// sans laisser le catch s'exécuter. L'ingestion laisse une réserve
// (dailyIngestBudgetMs) pour le suivi ; chaque étape s'arrête avant et
// journalise. Ne pas ajouter de cron dans vercel.json.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  const startedAtMs = Date.now();
  try {
    const summary = await runFullIngestion({ budgetMs: dailyIngestBudgetMs() });
    let followUp: DailyFollowUpSummary;
    try {
      followUp = await runDailyAfterClose({ startedAtMs });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[daily] suivi après clôture interrompu : ${message}`);
      followUp = { budgetMs: 0, steps: [{ name: "follow-up", durationMs: 0, skipped: false, reason: message }] };
    }
    console.log(
      `[ingest] http done durationMs=${summary.durationMs} incomplete=${summary.incomplete} stoppedAt=${summary.stoppedAt ?? "-"} budgetMs=${summary.budgetMs} followUp=${followUp.steps.map((s) => `${s.name}:${s.skipped ? "skip" : s.durationMs}`).join(",")}`
    );
    return NextResponse.json({ ok: true, data: { ...summary, followUp } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Dernier filet de sécurité : si `runFullIngestion` lève malgré ses
    // propres try/catch internes (ex: erreur avant même le premier
    // connecteur — DB injoignable dès `prisma.company.findMany`), on alerte
    // quand même plutôt que de laisser échouer silencieusement.
    await sendIngestionAlert({ severity: "critical", title: "Échec complet du run d'ingestion", message });
    return NextResponse.json({ ok: false, error: "Échec de l'ingestion", details: message }, { status: 500 });
  }
}
