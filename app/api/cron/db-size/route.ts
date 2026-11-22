// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/db-size — Veille de la taille Postgres (Supabase Free, 500 Mo)
// ═══════════════════════════════════════════════════════════════════════════
// Mesure `pg_database_size` et les plus grosses tables (`pg_total_relation_size`
// + `n_live_tup`). Protégé par CRON_SECRET (en-tête `Authorization: Bearer …`
// ou `?secret=`). NON listé dans vercel.json (plan Hobby : 2 crons quotidiens) :
// appelé par `.github/workflows/db-size-watch.yml` (lun–ven 08:15 UTC).
//
// Si la taille dépasse DB_SIZE_ALERT_MB (défaut 350), un e-mail part via le
// transporteur déjà configuré (SMTP_* / EMAIL_FROM) vers ADMIN_EMAILS et,
// le cas échéant, ALERT_EMAIL_TO. Aucun secret dans la réponse JSON.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { measureDatabaseSize, sendDbSizeAlert } from "@/lib/db/database-size";
import { isCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401, headers: NO_STORE });
  }

  try {
    const report = await measureDatabaseSize();
    const alert = await sendDbSizeAlert(report);
    return NextResponse.json({ ok: true, data: { ...report, alert } }, { headers: NO_STORE });
  } catch (err) {
    if (!isDatabaseUnavailable(err)) {
      console.error("[db-size] échec de la mesure");
    }
    return NextResponse.json({ ok: false, error: "Base injoignable" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
