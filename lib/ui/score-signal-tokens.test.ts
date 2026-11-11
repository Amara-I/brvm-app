import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_OPACITY,
  SCORE_TIER_TOKENS,
  SIGNAL_ACCENT,
  SIGNAL_TOKENS,
  confidenceOpacity,
  contrastRatio,
  scoreTier,
  scoreTierLabel,
  signalFamily,
} from "./score-signal-tokens";

const LIGHT_BG = "#ffffff";
const LIGHT_PAGE = "#eef1ec";
const DARK_PANEL = "#0d1117";

function hue(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe("paliers du score", () => {
  it("≥70 Excellent, 55–69 Bon, 40–54 Moyen, <40 Faible", () => {
    expect(scoreTier(100)).toBe("excellent");
    expect(scoreTier(70)).toBe("excellent");
    expect(scoreTier(69.4)).toBe("good");
    expect(scoreTier(55)).toBe("good");
    expect(scoreTier(54)).toBe("average");
    expect(scoreTier(40)).toBe("average");
    expect(scoreTier(39)).toBe("weak");
    expect(scoreTier(0)).toBe("weak");
    expect(scoreTier(null)).toBeNull();
    expect(scoreTier(Number.NaN)).toBeNull();
    expect(scoreTierLabel("good")).toBe("Bon");
    expect(scoreTierLabel("average", "en")).toBe("Average");
  });

  it("jamais vert ni rouge : uniquement or / bleu / ardoise", () => {
    for (const tok of Object.values(SCORE_TIER_TOKENS)) {
      for (const c of [tok.fg, tok.fgDark]) {
        const h = hue(c);
        // Vert ≈ 90–170°, rouge ≈ 340–20°.
        expect(h >= 90 && h <= 170).toBe(false);
        expect(h >= 340 || h <= 20).toBe(false);
      }
    }
  });
});

describe("signal", () => {
  it("familles et icônes : acheter ▲ vert, conserver ● ambre, vendre ▼ rouge", () => {
    expect(signalFamily("ACHAT FORT")).toBe("buy");
    expect(signalFamily("ACHAT")).toBe("buy");
    expect(signalFamily("CONSERVER")).toBe("hold");
    expect(signalFamily("ALLÉGER")).toBe("sell");
    expect(signalFamily("VENDRE")).toBe("sell");
    expect(signalFamily("N/D")).toBeNull();
    expect(SIGNAL_TOKENS.ACHAT.icon).toBe("▲");
    expect(SIGNAL_TOKENS.CONSERVER.icon).toBe("●");
    expect(SIGNAL_TOKENS.VENDRE.icon).toBe("▼");
  });

  it("Conserver n'utilise plus l'or du score", () => {
    expect(SIGNAL_ACCENT.CONSERVER.toLowerCase()).not.toBe("#d4a843");
    expect(SIGNAL_TOKENS.CONSERVER.fg).not.toBe(SCORE_TIER_TOKENS.excellent.fg);
  });
});

describe("contraste accessible (WCAG AA texte ≥ 4,5:1)", () => {
  const all = [...Object.values(SCORE_TIER_TOKENS), ...Object.values(SIGNAL_TOKENS)];
  it("thème clair (carte blanche et fond de page)", () => {
    for (const tok of all) {
      expect(contrastRatio(tok.fg, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tok.fg, LIGHT_PAGE)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("thème sombre", () => {
    for (const tok of all) expect(contrastRatio(tok.fgDark, DARK_PANEL)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("confiance", () => {
  it("point plus discret quand la confiance baisse", () => {
    expect(confidenceOpacity("Élevée")).toBe(1);
    expect(confidenceOpacity("Faible")).toBeLessThan(confidenceOpacity("Moyenne")!);
    expect(confidenceOpacity("N/D")).toBeNull();
    expect(Object.keys(CONFIDENCE_OPACITY)).toHaveLength(3);
  });
});
