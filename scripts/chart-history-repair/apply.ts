// Réparation des historiques de graphes (audit du 22/11/2026).
//
// Idempotent et réversible. Par défaut : simulation (aucune écriture).
//
//   npx ts-node -r ./scripts/register-paths.cjs scripts/chart-history-repair/apply.ts            # simulation
//   npx ts-node -r ./scripts/register-paths.cjs scripts/chart-history-repair/apply.ts --apply    # écrit
//   npx ts-node -r ./scripts/register-paths.cjs scripts/chart-history-repair/apply.ts --rollback # annule
//
// Options :
//   --min-confidence=high|medium   (défaut medium) ignore les lignes moins sûres
//   --only=outliers,ngx-prices,brvm-prices,ngx-indices,charts
//   --skip-charts                  ne reconstruit pas chart_series à la fin
//
// Règles :
//  • une clôture n'est insérée que si (société, date) n'a AUCUNE ligne canonique ;
//    aucune ligne existante n'est modifiée par l'insertion (ON CONFLICT DO NOTHING) ;
//  • identifiants déterministes préfixés `chr2611_` (prix) / `chr2611i_` (indices) :
//    relancer le script ne crée pas de doublon, le rollback les supprime ;
//  • aberrations : `demote` passe la ligne en non canonique (et promeut, s'il
//    existe, un autre relevé du même jour) ; `fix` corrige la clôture. Les deux
//    vérifient l'ancienne valeur et sont annulés par --rollback.
//  • DATABASE_URL n'est jamais affiché.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { refreshChartSeries } from "../../lib/charts/refresh-chart-series";

type Confidence = "high" | "medium";
type Step = "outliers" | "ngx-prices" | "brvm-prices" | "ngx-indices" | "charts";

const DATA = path.join(__dirname, "data");
const PRICE_PREFIX = "chr2611_";
const INDEX_PREFIX = "chr2611i_";
const BATCH = 2_000;
/** Ordre de promotion quand une ligne canonique aberrante est rétrogradée. */
const SOURCE_PRIORITY = ["BRVM_OFFICIEL", "NGX_OFFICIEL", "SIKAFINANCE", "RICHBOURSE", "OUESTBOURSE"];

function readCsv(file: string): Record<string, string>[] {
  const text = readFileSync(path.join(DATA, file), "utf8").replace(/\r/g, "");
  const lines = text.split("\n").filter((l) => l.length > 0);
  const parse = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const header = parse(lines[0]!);
  return lines.slice(1).map((line) => {
    const cells = parse(line);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}

const rank = (c: string) => (c === "high" ? 2 : c === "medium" ? 1 : 0);
const stableId = (prefix: string, ...parts: string[]) =>
  prefix + createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 24);

interface Args {
  mode: "dry-run" | "apply" | "rollback";
  minConfidence: Confidence;
  steps: Set<Step>;
}

function parseArgs(argv: string[]): Args {
  const mode = argv.includes("--rollback") ? "rollback" : argv.includes("--apply") ? "apply" : "dry-run";
  const mc = argv.find((a) => a.startsWith("--min-confidence="))?.split("=")[1];
  const minConfidence: Confidence = mc === "high" ? "high" : "medium";
  const only = argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  const all: Step[] = ["outliers", "ngx-prices", "brvm-prices", "ngx-indices", "charts"];
  const steps = new Set<Step>(only ? (only.split(",") as Step[]).filter((s) => all.includes(s)) : all);
  if (argv.includes("--skip-charts")) steps.delete("charts");
  return { mode, minConfidence, steps };
}

async function companyIds(exchange: "NGX" | "BRVM"): Promise<Map<string, string>> {
  const rows = await prisma.company.findMany({ where: { exchange }, select: { id: true, ticker: true } });
  return new Map(rows.map((r) => [r.ticker.toUpperCase(), r.id]));
}

// ─── Aberrations ────────────────────────────────────────────────────────────
async function outliers(args: Args): Promise<void> {
  const rows = readCsv("outliers.csv").filter((r) => rank(r.confidence!) >= rank(args.minConfidence));
  let done = 0;
  let skipped = 0;
  for (const r of rows) {
    const id = r.id!;
    const oldClose = new Prisma.Decimal(r.old_close!);
    if (args.mode === "rollback") {
      if (r.action === "fix") {
        done += await prisma.$executeRaw`UPDATE price_history SET close_price = ${oldClose} WHERE id = ${id} AND close_price = ${new Prisma.Decimal(r.new_close!)}`;
      } else {
        // État d'origine : la ligne aberrante était la seule canonique du jour.
        done += await prisma.$transaction(async (tx) => {
          const target = await tx.priceHistory.findUnique({ where: { id }, select: { companyId: true, date: true, isCanonical: true } });
          if (!target || target.isCanonical) return 0;
          await tx.priceHistory.updateMany({
            where: { companyId: target.companyId, date: target.date, id: { not: id }, isCanonical: true },
            data: { isCanonical: false },
          });
          await tx.priceHistory.update({ where: { id }, data: { isCanonical: true } });
          return 1;
        });
      }
      continue;
    }
    const current = await prisma.priceHistory.findUnique({
      where: { id },
      select: { companyId: true, date: true, isCanonical: true, closePrice: true },
    });
    if (!current) {
      skipped++;
      continue;
    }
    if (r.action === "fix") {
      const target = new Prisma.Decimal(r.new_close!);
      if (current.closePrice.equals(target) || !current.closePrice.equals(oldClose)) {
        skipped++;
        continue;
      }
      if (args.mode === "apply") await prisma.priceHistory.update({ where: { id }, data: { closePrice: target } });
      done++;
      continue;
    }
    // demote
    if (!current.isCanonical || !current.closePrice.equals(oldClose)) {
      skipped++;
      continue;
    }
    if (args.mode === "apply") {
      await prisma.$transaction(async (tx) => {
        await tx.priceHistory.update({ where: { id }, data: { isCanonical: false } });
        const alternatives = await tx.priceHistory.findMany({
          where: { companyId: current.companyId, date: current.date, id: { not: id }, source: { not: "MANUEL" } },
          select: { id: true, source: true },
        });
        alternatives.sort((a, b) => SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source));
        if (alternatives[0]) await tx.priceHistory.update({ where: { id: alternatives[0].id }, data: { isCanonical: true } });
      });
    }
    done++;
  }
  console.log(`[aberrations] ${args.mode} : ${done} ligne(s) traitée(s), ${skipped} déjà à jour / introuvable(s) (sur ${rows.length})`);
}

// ─── Clôtures ───────────────────────────────────────────────────────────────
async function prices(args: Args, file: string, exchange: "NGX" | "BRVM"): Promise<string[]> {
  const label = `[prix ${exchange}]`;
  if (args.mode === "rollback") {
    const n = await prisma.$executeRaw`DELETE FROM price_history p USING companies c WHERE p.company_id = c.id AND c.exchange::text = ${exchange} AND p.id LIKE ${PRICE_PREFIX + "%"}`;
    console.log(`${label} rollback : ${n} ligne(s) supprimée(s)`);
    return [];
  }
  const ids = await companyIds(exchange);
  const rows = readCsv(file).filter((r) => rank(r.confidence!) >= rank(args.minConfidence));
  const unknown = new Set<string>();
  const batch: { id: string; cid: string; date: string; close: string; volume: string | null; source: string }[] = [];
  for (const r of rows) {
    const cid = ids.get(r.ticker!.toUpperCase());
    if (!cid) {
      unknown.add(r.ticker!);
      continue;
    }
    batch.push({
      id: stableId(PRICE_PREFIX, exchange, r.ticker!, r.date!, r.source!),
      cid,
      date: r.date!,
      close: r.close!,
      volume: r.volume ? String(Math.round(Number(r.volume))) : null,
      source: r.source!,
    });
  }
  let inserted = 0;
  let wouldInsert = 0;
  const touched = new Set<string>();
  for (let i = 0; i < batch.length; i += BATCH) {
    const part = batch.slice(i, i + BATCH);
    const json = JSON.stringify(part);
    if (args.mode === "apply") {
      inserted += await prisma.$executeRaw`
        INSERT INTO price_history (id, company_id, date, close_price, volume, source, is_canonical, ingested_at, created_at)
        SELECT x.id, x.cid, x.date::date, x.close::numeric, x.volume::bigint, x.source::data_source, true, now(), now()
        FROM json_to_recordset(${json}::json) AS x(id text, cid text, date text, close text, volume text, source text)
        WHERE NOT EXISTS (
          SELECT 1 FROM price_history p WHERE p.company_id = x.cid AND p.date = x.date::date AND p.is_canonical
        )
        ON CONFLICT DO NOTHING`;
    } else {
      const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM json_to_recordset(${json}::json) AS x(id text, cid text, date text)
        WHERE NOT EXISTS (SELECT 1 FROM price_history p WHERE p.company_id = x.cid AND p.date = x.date::date AND p.is_canonical)`;
      wouldInsert += Number(n);
    }
    for (const row of part) touched.add(row.cid);
  }
  console.log(
    `${label} ${args.mode} : ${args.mode === "apply" ? `${inserted} insérée(s)` : `${wouldInsert} à insérer`} sur ${batch.length} candidates` +
      (unknown.size ? ` ; tickers inconnus ignorés : ${[...unknown].join(", ")}` : "")
  );
  const byId = new Map([...ids].map(([t, id]) => [id, t]));
  return [...touched].map((id) => byId.get(id)!).filter(Boolean);
}

// ─── Indices NGX ────────────────────────────────────────────────────────────
async function indices(args: Args): Promise<void> {
  if (args.mode === "rollback") {
    const n = await prisma.$executeRaw`DELETE FROM market_index_values WHERE id LIKE ${INDEX_PREFIX + "%"}`;
    console.log(`[indices NGX] rollback : ${n} ligne(s) supprimée(s)`);
    return;
  }
  const idx = await prisma.marketIndex.findMany({ where: { exchange: "NGX" }, select: { id: true, code: true } });
  const ids = new Map(idx.map((m) => [m.code, m.id]));
  const rows = readCsv("ngx_indices.csv").filter((r) => rank(r.confidence!) >= rank(args.minConfidence));
  const part = rows
    .filter((r) => ids.has(r.code!))
    .map((r) => ({
      id: stableId(INDEX_PREFIX, r.code!, r.date!),
      mid: ids.get(r.code!)!,
      date: r.date!,
      value: r.value!,
      change: r.change_percent || null,
    }));
  const json = JSON.stringify(part);
  if (args.mode === "apply") {
    const n = await prisma.$executeRaw`
      INSERT INTO market_index_values (id, market_index_id, date, value, change_percent, source, is_canonical, created_at)
      SELECT x.id, x.mid, x.date::date, x.value::numeric, x.change::numeric, 'NGX_OFFICIEL'::data_source, true, now()
      FROM json_to_recordset(${json}::json) AS x(id text, mid text, date text, value text, change text)
      WHERE NOT EXISTS (SELECT 1 FROM market_index_values v WHERE v.market_index_id = x.mid AND v.date = x.date::date AND v.is_canonical)
      ON CONFLICT DO NOTHING`;
    console.log(`[indices NGX] apply : ${n} insérée(s) sur ${part.length} candidates`);
  } else {
    const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM json_to_recordset(${json}::json) AS x(mid text, date text)
      WHERE NOT EXISTS (SELECT 1 FROM market_index_values v WHERE v.market_index_id = x.mid AND v.date = x.date::date AND v.is_canonical)`;
    console.log(`[indices NGX] simulation : ${Number(n)} à insérer sur ${part.length} candidates`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL manquant");
    process.exit(2);
  }
  const args = parseArgs(process.argv.slice(2));
  console.log(`mode=${args.mode} confiance≥${args.minConfidence} étapes=${[...args.steps].join(",")}`);
  // Aberrations d'abord : une date libérée peut ensuite recevoir la clôture Sika.
  if (args.steps.has("outliers")) await outliers(args);
  const touched: string[] = [];
  if (args.steps.has("ngx-prices")) touched.push(...(await prices(args, "ngx_prices.csv", "NGX")));
  if (args.steps.has("brvm-prices")) touched.push(...(await prices(args, "brvm_prices.csv", "BRVM")));
  if (args.steps.has("ngx-indices")) await indices(args);
  if (args.steps.has("charts") && args.mode !== "dry-run") {
    // chart_series suit price_history : reconstruction forcée des séries touchées.
    const brvm = readCsv("outliers.csv").filter((r) => r.exchange === "BRVM").map((r) => r.ticker!);
    const symbols = [...new Set([...touched, ...brvm])];
    const companies = await refreshChartSeries({ symbols, kinds: ["COMPANY"], force: true, logger: () => undefined });
    const ngxIdx = await refreshChartSeries({ exchange: "NGX", kinds: ["INDEX"], force: true, logger: () => undefined });
    console.log(
      `[chart_series] ${companies.companiesUpdated} sociétés, ${ngxIdx.indicesUpdated} indices NGX reconstruits` +
        (companies.incomplete || ngxIdx.incomplete ? " (incomplet : relancer avec --only=charts)" : "")
    );
  }
}

main()
  .catch((err) => {
    console.error("échec :", err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
