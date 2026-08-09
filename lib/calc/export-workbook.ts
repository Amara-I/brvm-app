// ═══════════════════════════════════════════════════════════════════════════
// Génération du classeur Excel — étape 5 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Port TypeScript strict de `exportToExcel()` (reference/BRVM_Dashboard.jsx),
// adapté pour tourner CÔTÉ SERVEUR (route API) plutôt que dans le navigateur :
// au lieu de déclencher un téléchargement via `XLSX.writeFile`, `buildBrvmWorkbook`
// retourne un Buffer que la route appelante renvoie avec les en-têtes HTTP
// appropriés (cf. app/api/export/excel/route.ts).
//
// La structure du classeur (3 feuilles, en-têtes de colonnes, ordre des
// colonnes, largeurs) est reprise du JSX d'origine, à UNE correction près,
// documentée ci-dessous (feuille "Projections").
//
// ⚠️ Sécurité : ce module utilise `xlsx` UNIQUEMENT EN ÉCRITURE, à partir de
// données internes de confiance (jamais de fichier/entrée utilisateur
// parsé). Les CVE connues du paquet `xlsx` (prototype pollution, ReDoS,
// cf. GHSA-4r6h-8v6p-xvw6 / GHSA-5pgg-2g8v-p4x9) concernent exclusivement la
// LECTURE de fichiers non fiables (XLSX.read/readFile) — hors périmètre ici.
// Le paquet est installé depuis le CDN officiel SheetJS (version patchée,
// non publiée sur le registre npm) plutôt que `npm install xlsx` — cf.
// package.json (`"xlsx": "https://cdn.sheetjs.com/..."`) et AGENTS.md.
//
// 🐛 Bug corrigé par rapport au JSX d'origine : dans `exportToExcel`, la
// feuille "Projections" construisait ses valeurs avec
// `[0,0,1,1,2,2].map((i,j) => j%2===0 ? proj[i].projected : proj[i].optimistic)`
// puis `proj[2].pessimistic, proj[3].projected, proj[4].projected` — ce qui
// désalignait les colonnes "Pess." avec les bonnes années (ex: la colonne
// "2027 Pess." contenait en réalité `proj[1].projected`, soit la valeur
// "2028 Proj."). Les en-têtes de colonnes, eux, étaient corrects. Ici, les
// valeurs sont calculées pour correspondre exactement aux en-têtes
// (cohérent avec le principe du projet : "prioriser la fiabilité des
// données financières").

import * as XLSX from "xlsx";
import { calcMetrics } from "./calc-metrics";
import { projectPrices } from "./project-prices";

export interface ExportCompanyRow {
  ticker: string;
  name: string;
  country: string;
  sector: string;
  per: number;
  mktcap: number;
  /// Cours de clôture par année. 0/absent = non coté cette année-là.
  prices: Record<number, number>;
  /// Dividende par action et par année. 0/absent = aucun dividende versé.
  dividends: Record<number, number>;
}

/// Construit le classeur BRVM (3 feuilles : "Données BRVM", "Projections",
/// "Classements") et le sérialise en Buffer .xlsx, prêt à être renvoyé par
/// une route API (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
///
/// `years` doit être la même liste d'années chronologiques utilisée pour
/// `calcMetrics`/`projectPrices` (2015-2026 dans le jeu de données actuel).
export function buildBrvmWorkbook(companies: ExportCompanyRow[], years: number[]): Buffer {
  const wb = XLSX.utils.book_new();

  const metricsByTicker = new Map(
    companies.map((co) => [co.ticker, calcMetrics({ years, prices: co.prices, dividends: co.dividends, per: co.per })])
  );

  // ── Feuille 1 : Données complètes ─────────────────────────────────────
  const headers1 = [
    "Ticker",
    "Société",
    "Pays",
    "Secteur",
    "PER",
    "Cap.(Mds FCFA)",
    ...years.flatMap((y) => [`Cours ${y}`, `Div. ${y}`]),
    "Score",
    "Signal",
    "Perf.5ans(%)",
    "Perf.10ans(%)",
    "Rend.Div.(%)",
    "Volatilité",
    "Risque",
  ];
  const rows1 = companies.map((co) => {
    const m = metricsByTicker.get(co.ticker)!;
    return [
      co.ticker,
      co.name,
      co.country,
      co.sector,
      co.per,
      co.mktcap,
      ...years.flatMap((y) => [co.prices[y] || 0, co.dividends[y] || 0]),
      m.score,
      m.signal.label,
      m.perf5Percent,
      m.perf10Percent,
      m.dividendYieldPercent,
      m.volatilityPercent,
      m.riskLevel,
    ];
  });
  const ws1 = XLSX.utils.aoa_to_sheet([headers1, ...rows1]);
  ws1["!cols"] = headers1.map((_, i) => ({ wch: i < 6 ? 18 : 12 }));
  XLSX.utils.book_append_sheet(wb, ws1, "Données BRVM");

  // ── Feuille 2 : Projections à 5 ans (cf. note "bug corrigé" ci-dessus) ─
  const baseYear = years[years.length - 1] ?? new Date().getFullYear();
  const headers2 = [
    "Ticker",
    "Société",
    `${baseYear + 1} Proj.`,
    `${baseYear + 1} Opt.`,
    `${baseYear + 1} Pess.`,
    `${baseYear + 2} Proj.`,
    `${baseYear + 2} Opt.`,
    `${baseYear + 2} Pess.`,
    `${baseYear + 3} Proj.`,
    `${baseYear + 4} Proj.`,
    `${baseYear + 5} Proj.`,
  ];
  const rows2 = companies.map((co) => {
    const historicalPrices = years.map((year) => ({ year, price: co.prices[year] ?? 0 }));
    const proj = projectPrices(historicalPrices, { futureYears: 5, baseYear });
    return [
      co.ticker,
      co.name,
      proj[0]?.projected || 0,
      proj[0]?.optimistic || 0,
      proj[0]?.pessimistic || 0,
      proj[1]?.projected || 0,
      proj[1]?.optimistic || 0,
      proj[1]?.pessimistic || 0,
      proj[2]?.projected || 0,
      proj[3]?.projected || 0,
      proj[4]?.projected || 0,
    ];
  });
  const ws2 = XLSX.utils.aoa_to_sheet([headers2, ...rows2]);
  XLSX.utils.book_append_sheet(wb, ws2, "Projections");

  // ── Feuille 3 : Classements (triés par score décroissant) ─────────────
  const sorted = [...companies].sort((a, b) => metricsByTicker.get(b.ticker)!.score - metricsByTicker.get(a.ticker)!.score);
  const headers3 = ["Rang", "Ticker", "Société", "Secteur", "Score", "Signal", "Perf.5ans", "Rend.Div.", "Risque"];
  const rows3 = sorted.map((co, i) => {
    const m = metricsByTicker.get(co.ticker)!;
    return [i + 1, co.ticker, co.name, co.sector, m.score, m.signal.label, m.perf5Percent, m.dividendYieldPercent, m.riskLevel];
  });
  const ws3 = XLSX.utils.aoa_to_sheet([headers3, ...rows3]);
  XLSX.utils.book_append_sheet(wb, ws3, "Classements");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/// Nom de fichier suggéré, dans le même format que l'original
/// (`BRVM_Analyse_JJ-MM-AAAA.xlsx`, les `/` remplacés par `-`).
export function buildExportFileName(lastUpdate: string): string {
  return `BRVM_Analyse_${lastUpdate.replace(/\//g, "-")}.xlsx`;
}
