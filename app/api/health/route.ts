// ═══════════════════════════════════════════════════════════════════════════
// GET /api/health — sonde de production (uptime, sans secrets)
// ═══════════════════════════════════════════════════════════════════════════
// Vérifie que l'app Next.js répond et que Prisma peut exécuter `SELECT 1`
// contre Postgres (Supabase). Requête légère, cache désactivé, aucun secret
// ni message d'erreur brut dans le JSON.
//
// HTTP 200 = sain · HTTP 503 = base injoignable / timeout sonde (3 s).
// HEAD est accepté (même statut, sans corps) — utile pour certains monitors.
// Exclu du rate limiting API (`middleware.ts`) pour ne jamais 429 un probe.
//
// UptimeRobot / cron externe / Better Stack :
//   URL  : https://<host>/api/health
//   Type : HTTPS — attendre le statut 200
//   Mot-clé JSON (optionnel) : "ok":true
//   Intervalle recommandé : 5 min (ne pas descendre sous 1 min : egress
//   Postgres + cold start Vercel). Alerter sur 503 ou timeout HTTP.
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { buildHealthPayload, probeDatabase } from "@/lib/api/health-check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET() {
  const { status, body } = buildHealthPayload(await probeDatabase());
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function HEAD() {
  const res = await GET();
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
