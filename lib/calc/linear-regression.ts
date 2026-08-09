// ═══════════════════════════════════════════════════════════════════════════
// Régression linéaire simple (moindres carrés) — étape 5 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Port TypeScript strict, fonctionnellement IDENTIQUE à `linearRegression()`
// dans reference/BRVM_Dashboard.jsx (mêmes formules, mêmes résultats pour les
// mêmes entrées — cf. lib/calc/linear-regression.test.ts et la fixture
// lib/calc/__fixtures__/golden-legacy-output.json générée depuis le JSX
// d'origine pour garantir la non-régression numérique).

export interface LinearRegressionResult {
  /// Pente (m) de la droite y = m·x + b.
  slope: number;
  /// Ordonnée à l'origine (b).
  intercept: number;
}

/// Calcule la régression linéaire (moindres carrés) d'une série de valeurs,
/// où `x` est simplement l'index 0..n-1 dans le tableau (comme dans le JSX
/// d'origine : pas de vraies dates, juste un rang chronologique).
export function linearRegression(values: number[]): LinearRegressionResult {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * values[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const denominator = n * sumX2 - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}
