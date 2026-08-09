// ═══════════════════════════════════════════════════════════════════════════
// Projection de cours par régression linéaire — étape 5 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Port TypeScript strict de `projectPrices()` (reference/BRVM_Dashboard.jsx).
// Même modèle mathématique (régression linéaire sur les cours historiques
// valides, scénarios optimiste/pessimiste à ±15%), mais généralisé pour
// fonctionner avec n'importe quelle plage d'années (le JSX d'origine avait
// l'année de départ des projections (2026) et le nombre d'années observées
// codés en dur — cf. `baseYear` ci-dessous).
//
// ⚠️ Non-régression : pour les données seedées (années 2015-2026,
// `baseYear = 2026`), cette fonction produit EXACTEMENT les mêmes valeurs que
// l'ancien code JSX — vérifié par lib/calc/project-prices.test.ts contre
// lib/calc/__fixtures__/golden-legacy-output.json.

import { linearRegression } from "./linear-regression";

export interface PriceProjection {
  year: number;
  projected: number;
  optimistic: number;
  pessimistic: number;
}

export interface ProjectPricesOptions {
  /// Nombre d'années à projeter dans le futur (3/5/7/10 dans l'UI existante).
  futureYears?: number;
  /// Dernière année de la série historique (sert de point de départ pour la
  /// numérotation des années projetées). Dans le JSX d'origine, cette valeur
  /// était codée en dur à 2026 ("2026 + i + 1") ; ici elle est dérivée de la
  /// donnée elle-même, ce qui rend la fonction correcte au-delà de 2026 sans
  /// modification (contrairement à l'original).
  baseYear?: number;
  /// Amplitude des scénarios optimiste/pessimiste (0.15 = ±15%, comme le JSX).
  scenarioSpread?: number;
}

/// Projette les cours futurs d'une société à partir de son historique de
/// cours (valeurs > 0 uniquement, comme dans `calcMetrics`/le JSX d'origine —
/// une valeur à 0 signifie "non coté cette année-là" et est exclue).
export function projectPrices(
  historicalPrices: Array<{ year: number; price: number }>,
  options: ProjectPricesOptions = {}
): PriceProjection[] {
  const sorted = [...historicalPrices].sort((a, b) => a.year - b.year);
  const validPrices = sorted.filter((p) => p.price > 0).map((p) => p.price);
  if (validPrices.length < 2) return [];

  const futureYears = options.futureYears ?? 5;
  const baseYear = options.baseYear ?? sorted[sorted.length - 1]?.year ?? new Date().getFullYear();
  const scenarioSpread = options.scenarioSpread ?? 0.15;

  const { slope, intercept } = linearRegression(validPrices);
  const lastIdx = validPrices.length - 1;

  return Array.from({ length: futureYears }, (_, i) => {
    const x = lastIdx + i + 1;
    const central = intercept + slope * x;
    return {
      year: baseYear + i + 1,
      projected: Math.max(0, Math.round(central)),
      optimistic: Math.max(0, Math.round(central * (1 + scenarioSpread))),
      pessimistic: Math.max(0, Math.round(central * (1 - scenarioSpread))),
    };
  });
}
