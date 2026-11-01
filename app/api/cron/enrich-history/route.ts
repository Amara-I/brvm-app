import { NextRequest, NextResponse } from "next/server";
import { enrichmentSchema } from "@/lib/ingestion/additive/plan";
import { runAdditiveEnrichment } from "@/lib/ingestion/additive/run";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
async function handle(request: NextRequest) {
  // Authentification par en-tête uniquement : aucun secret ne doit figurer dans les URLs de ce nouveau job.
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  const parsed = enrichmentSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 422 });
  if (parsed.data.apply === "1" && process.env.INGESTION_ADDITIVE_ENABLED !== "true") return NextResponse.json({ ok: true, skipped: true, reason: "INGESTION_ADDITIVE_ENABLED doit être activé explicitement après simulation" });
  const sourceFlag = parsed.data.exchange === "BRVM" ? "INGESTION_ADDITIVE_BRVM" : "INGESTION_ADDITIVE_NGX";
  if (process.env[sourceFlag] === "false") return NextResponse.json({ ok: true, skipped: true, reason: "Source désactivée" });
  try { return NextResponse.json({ ok: true, data: await runAdditiveEnrichment(parsed.data) }); }
  catch { return NextResponse.json({ ok: false, error: "Échec du rattrapage additif : consulter les logs protégés" }, { status: 500 }); }
}
export const GET = handle;
export const POST = handle;
