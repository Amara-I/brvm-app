// Déclenchement manuel (Bearer CRON_SECRET). Le passage quotidien est
// enchaîné après l'ingestion de 17:00 UTC ; cette route garde le plein
// maxDuration pour un rattrapage, sans le délai du cron partagé.
import { NextRequest, NextResponse } from "next/server";
import { runFinanceAgent } from "@/lib/finance-agent/run";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  try { return NextResponse.json({ ok: true, data: await runFinanceAgent() }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ ok: false, error: "Agent interrompu sans publication financière ; consulter les journaux protégés" }, { status: 500 }); }
}
