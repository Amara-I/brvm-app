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
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { runFullIngestion } from "@/lib/ingestion/run-full-ingestion";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";
import { isCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Hobby (Fluid) coupe la fonction à 300s — « Task timed out after 300 seconds » —
// sans laisser le catch s'exécuter. Le budget interne (240s, override
// INGESTION_CRON_BUDGET_MS) s'arrête avant et journalise chaque étape.
// Ne pas ajouter de cron dans vercel.json : le plan Hobby est limité à 2
// crons (ingest quotidien + research hebdomadaire).
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  try {
    const summary = await runFullIngestion();
    console.log(
      `[ingest] http done durationMs=${summary.durationMs} incomplete=${summary.incomplete} stoppedAt=${summary.stoppedAt ?? "-"} budgetMs=${summary.budgetMs}`
    );
    return NextResponse.json({ ok: true, data: summary });
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
