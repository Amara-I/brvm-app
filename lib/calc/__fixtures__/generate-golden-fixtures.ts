// ═══════════════════════════════════════════════════════════════════════════
// Générateur de "golden fixtures" — NE PAS UTILISER EN PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════
// Ce script exécute une copie VERBATIM des fonctions `linearRegression`,
// `projectPrices` et `calcMetrics` telles qu'elles existent dans
// `reference/BRVM_Dashboard.jsx` (aucune modification, aucune correction de
// bug), appliquées aux 20 sociétés de `prisma/seed-data/companies-full.ts`.
//
// Le fichier JSON généré (`golden-legacy-output.json`) sert de référence de
// non-régression pour `lib/calc/*.test.ts` : la nouvelle implémentation
// backend (TypeScript strict, paramétrée) doit produire EXACTEMENT les mêmes
// valeurs que l'ancien code JSX pour ces mêmes données, garantissant que le
// futur branchement de BRVM_Dashboard.jsx sur l'API (étape 8) ne changera
// aucun chiffre affiché.
//
// Régénération : npx ts-node lib/calc/__fixtures__/generate-golden-fixtures.ts
// ═══════════════════════════════════════════════════════════════════════════

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMPANIES_FULL, YEARS } from "../../../prisma/seed-data/companies-full";

// ─── Copie verbatim de reference/BRVM_Dashboard.jsx (lignes ~122-178) ──────

function legacyLinearRegression(data: number[]) {
  const n = data.length;
  const xs = data.map((_, i) => i);
  const ys = data;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a: number, b: number) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const b = (sumY - m * sumX) / n;
  return { m, b };
}

function legacyProjectPrices(company: (typeof COMPANIES_FULL)[number], futureYears = 5) {
  const validPrices = YEARS.map((y) => company.prices[y]).filter((p) => p > 0);
  if (validPrices.length < 2) return [] as Array<{ year: number; projected: number; optimistic: number; pessimistic: number }>;
  const { m, b } = legacyLinearRegression(validPrices);
  const lastIdx = validPrices.length - 1;
  return Array.from({ length: futureYears }, (_, i) => ({
    year: 2026 + i + 1,
    projected: Math.max(0, Math.round(b + m * (lastIdx + i + 1))),
    optimistic: Math.max(0, Math.round((b + m * (lastIdx + i + 1)) * 1.15)),
    pessimistic: Math.max(0, Math.round((b + m * (lastIdx + i + 1)) * 0.85)),
  }));
}

function legacyCalcMetrics(co: (typeof COMPANIES_FULL)[number]) {
  const validPrices = YEARS.filter((y) => co.prices[y] > 0).map((y) => co.prices[y]);
  const validDivs = YEARS.filter((y) => co.dividends[y] > 0).map((y) => co.dividends[y]);
  const perf5 =
    validPrices.length >= 6
      ? (((validPrices[validPrices.length - 1] - validPrices[validPrices.length - 6]) / validPrices[validPrices.length - 6]) * 100).toFixed(1)
      : "N/D";
  const perf10 =
    validPrices.length >= 10 ? (((validPrices[validPrices.length - 1] - validPrices[0]) / validPrices[0]) * 100).toFixed(1) : "N/D";
  const avgDiv = validDivs.length ? (validDivs.reduce((a, b) => a + b, 0) / validDivs.length).toFixed(0) : 0;
  const currentPrice = co.prices[2026] || co.prices[2025] || 0;
  const currentDiv = co.dividends[2026] || co.dividends[2025] || 0;
  const yield_ = currentPrice > 0 ? ((currentDiv / currentPrice) * 100).toFixed(2) : 0;
  const perfs: number[] = [];
  YEARS.slice(1).forEach((y, i) => {
    const p = co.prices[YEARS[i]];
    const q = co.prices[y];
    if (p > 0 && q > 0) perfs.push(Math.abs(((q - p) / p) * 100));
  });
  const volat = perfs.length ? (perfs.reduce((a, b) => a + b, 0) / perfs.length).toFixed(1) : "N/D";
  const risk = parseFloat(volat as string) < 10 ? "Faible" : parseFloat(volat as string) < 20 ? "Moyen" : "Élevé";
  let score = 0;
  if (perf5 !== "N/D") score += Math.min(30, parseFloat(perf5) / 3);
  score += Math.min(25, parseFloat(yield_ as string) * 3);
  score += (validDivs.length / 12) * 20;
  score += co.per < 8 ? 15 : co.per < 10 ? 10 : co.per < 12 ? 6 : 3;
  score += risk === "Faible" ? 10 : risk === "Moyen" ? 6 : 2;
  score = Math.min(100, Math.round(score));
  const sig =
    score >= 80
      ? { label: "ACHAT FORT", color: "#22C55E" }
      : score >= 65
        ? { label: "ACHAT", color: "#84CC16" }
        : score >= 50
          ? { label: "CONSERVER", color: "#D4A843" }
          : score >= 35
            ? { label: "ALLÉGER", color: "#F97316" }
            : { label: "VENDRE", color: "#EF4444" };
  return { perf5, perf10, avgDiv, yield_, volat, risk, score, sig, currentPrice, currentDiv };
}

// ─── Génération de la fixture ────────────────────────────────────────────

const fixtures = COMPANIES_FULL.map((co) => ({
  ticker: co.ticker,
  metrics: legacyCalcMetrics(co),
  projections: legacyProjectPrices(co, 5),
}));

const outPath = join(__dirname, "golden-legacy-output.json");
writeFileSync(outPath, JSON.stringify(fixtures, null, 2), "utf-8");
console.log(`✔ Fixture générée : ${outPath} (${fixtures.length} sociétés)`);
