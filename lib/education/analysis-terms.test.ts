import { describe, expect, it } from "vitest";
import { getTermBySlug } from "./catalog";
import {
  educationSlugForAnalysisLabel,
  educationSlugForRiskPillar,
  OVERVIEW_KEY_TERM_SLUGS,
} from "./analysis-terms";

describe("educationSlugForAnalysisLabel", () => {
  it("relie les libellés d’analyse aux fiches Éducation", () => {
    expect(educationSlugForAnalysisLabel("Gestion du risque")).toBe("gestion-du-risque");
    expect(educationSlugForAnalysisLabel("Confiance")).toBe("confiance-du-signal");
    expect(educationSlugForAnalysisLabel("PER")).toBe("per-price-earnings-ratio");
    expect(educationSlugForAnalysisLabel("Cours de clôture (2026)")).toBe("cours");
    expect(educationSlugForAnalysisLabel("Drawdown max : 12 %")).toBe("drawdown-maximal");
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
