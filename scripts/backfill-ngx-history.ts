// Historique NGX (5 ans par défaut), à lancer sur une machine qui a DATABASE_URL.
// Sans sortie Postgres : GET /api/cron/ngx-history (voir docs/ngx-phase1.md).
//
//   npm run history:ngx
//   npm run history:ngx -- --from=2021-10-27 --to=2026-10-27
//   npm run history:ngx -- --limit=5
//   npm run history:ngx -- --indices=off --charts=off
//
// Reprise : le fichier `.cache/ngx-backfill.json` et le dernier
// `ingestion_logs` (errors.kind = NGX_HISTORY) indiquent la prochaine date.
// Une date déjà pourvue d'au moins 80 clôtures canoniques NGX est sautée.
// Les 404 (jours fériés) sont mémorisés et ne sont pas retéléchargés.
//
// Volume attendu : ~146 titres × ~250 séances × 5 ans ≈ 180 000 lignes de
// cours, plus des séries `chart_series` compactes. Pas de PDF en base.
// Cible : rester sous ~200 Mo sur le palier gratuit Supabase (base ~70 Mo).

import { prisma } from "../lib/prisma";
import { runNgxHistoryBackfill } from "../lib/ingestion/run-ngx-history";

function arg(name: string): string | undefined {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function flag(name: string): boolean | undefined {
  const value = arg(name);
  if (value == null) return undefined;
  return value !== "off" && value !== "false" && value !== "0";
}

async function main() {
  const limitRaw = arg("limit");
  const summary = await runNgxHistoryBackfill({
    from: arg("from"),
    to: arg("to"),
    limit: limitRaw ? Number(limitRaw) : undefined,
    indices: flag("indices"),
    charts: flag("charts"),
    resume: flag("resume") !== false,
  });
  console.log(JSON.stringify(summary));
  if (summary.next) console.log(`Reprise : npm run history:ngx  (prochaine date ${summary.next})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
