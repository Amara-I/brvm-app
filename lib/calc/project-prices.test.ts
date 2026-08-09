// ═══════════════════════════════════════════════════════════════════════════
// Tests de non-régression — projectPrices vs. sortie de reference/BRVM_Dashboard.jsx
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import { projectPrices } from "./project-prices";
import { COMPANIES_FULL, YEARS } from "../../prisma/seed-data/companies-full";
import golden from "./__fixtures__/golden-legacy-output.json";

const YEARS_ARRAY = [...YEARS];

describe("projectPrices — parité avec le JSX d'origine", () => {
  for (const company of COMPANIES_FULL) {
    const expected = golden.find((g) => g.ticker === company.ticker);

    it(`produit les mêmes projections à 5 ans que le JSX pour ${company.ticker}`, () => {
      expect(expected).toBeDefined();
      const historicalPrices = YEARS_ARRAY.map((year) => ({ year, price: company.prices[year] ?? 0 }));

      // Le JSX d'origine appelle `projectPrices(co, 5)` et numérote les
      // années projetées à partir de 2026 codé en dur ("2026 + i + 1"),
      // quelle que soit la dernière année réellement disponible pour la
      // société. On reproduit ce point de départ ici via `baseYear: 2026`
      // pour garantir une comparaison à l'identique (cf. commentaire dans
      // project-prices.ts sur `baseYear`).
      const result = projectPrices(historicalPrices, { futureYears: 5, baseYear: 2026 });

      expect(result).toEqual(expected!.projections);
    });
  }
});
