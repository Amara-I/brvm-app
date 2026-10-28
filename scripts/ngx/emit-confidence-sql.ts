// Génère le SQL de rattrapage des niveaux de confiance (voir lib/ngx/fundamentals/confidence-sql.ts).
// Ne se connecte à aucune base : écrit seulement des fichiers .sql à relire.
//   npx tsx scripts/ngx/emit-confidence-sql.ts <fundamentals.csv> <out-dir>
//   -> <out-dir>/backfill_confidence.sql (UPDATE, à exécuter après revue) et preview_confidence.sql (SELECT, lecture seule)
import fs from "node:fs";
import path from "node:path";
import { readCsv } from "./csv-read";
import type { FundamentalsCsvRow } from "../../lib/ngx/fundamentals/load-plan";
import { buildConfidenceBackfillSql, buildConfidencePreviewSql } from "../../lib/ngx/fundamentals/confidence-sql";

const [csvPath, outDir] = process.argv.slice(2);
if (!csvPath || !outDir) {
  console.error("usage : emit-confidence-sql.ts <fundamentals.csv> <out-dir>");
  process.exit(2);
}
const rows = readCsv<FundamentalsCsvRow>(csvPath);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "backfill_confidence.sql"), buildConfidenceBackfillSql(rows));
fs.writeFileSync(path.join(outDir, "preview_confidence.sql"), buildConfidencePreviewSql(rows));
console.log(`[ngx-confidence] ${rows.length} lignes CSV → ${outDir}/backfill_confidence.sql (UPDATE, non exécuté) et preview_confidence.sql (SELECT)`);
