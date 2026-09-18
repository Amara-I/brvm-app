import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTermBySlug } from "./catalog";
import {
  educationSlugForAnalysisLabel,
  educationSlugForRiskPillar,
  MARKET_EXPANDED_KPI_LABELS,
  OVERVIEW_KEY_TERM_SLUGS,
} from "./analysis-terms";

describe("educationSlugForAnalysisLabel", () => {
  it("relie les libellés d’analyse aux fiches Éducation", () => {
    expect(educationSlugForAnalysisLabel("Gestion du risque")).toBe("gestion-du-risque");
    expect(educationSlugForAnalysisLabel("Confiance")).toBe("confiance-du-signal");
    expect(educationSlugForAnalysisLabel("PER")).toBe("per-price-earnings-ratio");
    expect(educationSlugForAnalysisLabel("Cours de clôture (2026)")).toBe("cours");
    expect(educationSlugForAnalysisLabel("Cours actuel")).toBe("cours");
    expect(educationSlugForAnalysisLabel("Cours actuel (FCFA)")).toBe("cours");
    expect(educationSlugForAnalysisLabel("Drawdown max : 12 %")).toBe("drawdown-maximal");
    expect(educationSlugForAnalysisLabel("Perf. 5 ans (%)")).toBe("horizons-c-m-l");
    expect(educationSlugForAnalysisLabel("Risque (volatilité)")).toBe("risque");
  });

  it("relie chaque libellé KPI de /marche à une fiche catalogue", () => {
    for (const label of MARKET_EXPANDED_KPI_LABELS) {
      const slug = educationSlugForAnalysisLabel(label);
      expect(slug, label).toBeTruthy();
      expect(getTermBySlug(slug!), label).toBeTruthy();
    }
  });

  it("garde les libellés KPI du panneau /marche alignés sur le mapping", () => {
    const src = readFileSync(
      new URL("../../components/marche/MarketBoardClient.tsx", import.meta.url),
      "utf8"
    );
    for (const label of MARKET_EXPANDED_KPI_LABELS) {
      expect(src, label).toContain(`label: "${label}"`);
    }
  });

  it("mappe les piliers de risque", () => {
    expect(educationSlugForRiskPillar("marche")).toBe("risque-de-marche");
    expect(educationSlugForRiskPillar("liquidite")).toBe("liquidite");
  });

  it("pointe vers des slugs réellement présents au catalogue", () => {
    for (const slug of OVERVIEW_KEY_TERM_SLUGS) {
      expect(getTermBySlug(slug), slug).toBeTruthy();
    }
    expect(getTermBySlug("gestion-du-risque")?.title).toMatch(/Gestion du risque/i);
  });
});
