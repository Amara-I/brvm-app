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

export const dynamic = "force-dynamic";
// L'ingestion peut prendre plusieurs dizaines de secondes (rate limiting
// respectueux par hôte, cf. http-client.ts) — nécessite un plan Vercel Pro
// (ou Fluid Compute) pour dépasser les 10s du plan Hobby. À ajuster selon
// le plan effectivement utilisé en production.
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Aucun secret configuré = configuration incomplète, jamais un "ouvert à
    // tous" par défaut — on refuse plutôt que de risquer un déclenchement
    // non maîtrisé du scraping en production.
    return false;
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${expected}`) return true;
  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === expected;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  try {
    const summary = await runFullIngestion();
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
