import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_TOKENS,
  SCORE_TIER_TOKENS,
  SIGNAL_ACCENT,
  SIGNAL_TOKENS,
  TRAFFIC_LIGHT_TOKENS,
  confidenceToken,
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
});

describe("échelle partagée vert → rouge", () => {
  it("score, signal et confiance réutilisent les mêmes jetons", () => {
    expect(SCORE_TIER_TOKENS.excellent).toEqual(paintCheck("green"));
    expect(SCORE_TIER_TOKENS.good).toEqual(paintCheck("lime"));
    expect(SCORE_TIER_TOKENS.average).toEqual(paintCheck("amber"));
    expect(SCORE_TIER_TOKENS.weak).toEqual(paintCheck("red"));

    expect(SIGNAL_TOKENS["ACHAT FORT"].fg).toBe(TRAFFIC_LIGHT_TOKENS.green.fg);
    expect(SIGNAL_TOKENS.ACHAT.fg).toBe(TRAFFIC_LIGHT_TOKENS.lime.fg);
    expect(SIGNAL_TOKENS.CONSERVER.fg).toBe(TRAFFIC_LIGHT_TOKENS.amber.fg);
    expect(SIGNAL_TOKENS.ALLÉGER.fg).toBe(TRAFFIC_LIGHT_TOKENS.orange.fg);
    expect(SIGNAL_TOKENS.VENDRE.fg).toBe(TRAFFIC_LIGHT_TOKENS.red.fg);

    expect(CONFIDENCE_TOKENS.Élevée).toEqual(paintCheck("green"));
    expect(CONFIDENCE_TOKENS.Moyenne).toEqual(paintCheck("amber"));
    expect(CONFIDENCE_TOKENS.Faible).toEqual(paintCheck("red"));

    expect(SIGNAL_ACCENT.CONSERVER).toBe(TRAFFIC_LIGHT_TOKENS.amber.accent);
  });

  it("Excellent est vert, Faible est rouge", () => {
    const excellent = hue(SCORE_TIER_TOKENS.excellent.fgDark);
    const weak = hue(SCORE_TIER_TOKENS.weak.fgDark);
    expect(excellent >= 90 && excellent <= 170).toBe(true);
    expect(weak >= 340 || weak <= 20).toBe(true);
  });
});

function paintCheck(light: keyof typeof TRAFFIC_LIGHT_TOKENS) {
  const { fg, fgDark, bg } = TRAFFIC_LIGHT_TOKENS[light];
  return { fg, fgDark, bg };
}

describe("signal", () => {
  it("familles et icônes : acheter ▲, conserver ●, alléger/vendre ▼", () => {
    expect(signalFamily("ACHAT FORT")).toBe("buy");
    expect(signalFamily("ACHAT")).toBe("buy");
    expect(signalFamily("CONSERVER")).toBe("hold");
    expect(signalFamily("ALLÉGER")).toBe("sell");
    expect(signalFamily("VENDRE")).toBe("sell");
    expect(signalFamily("N/D")).toBeNull();
    expect(SIGNAL_TOKENS.ACHAT.icon).toBe("▲");
    expect(SIGNAL_TOKENS.CONSERVER.icon).toBe("●");
    expect(SIGNAL_TOKENS.ALLÉGER.icon).toBe("▼");
    expect(SIGNAL_TOKENS.VENDRE.icon).toBe("▼");
  });
});

describe("contraste accessible (WCAG AA texte ≥ 4,5:1)", () => {
  const all = [...Object.values(SCORE_TIER_TOKENS), ...Object.values(SIGNAL_TOKENS), ...Object.values(CONFIDENCE_TOKENS)];
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
  it("jeton coloré selon le niveau, pas une opacité", () => {
    expect(confidenceToken("Élevée")?.fg).toBe(TRAFFIC_LIGHT_TOKENS.green.fg);
    expect(confidenceToken("Moyenne")?.fg).toBe(TRAFFIC_LIGHT_TOKENS.amber.fg);
    expect(confidenceToken("Faible")?.fg).toBe(TRAFFIC_LIGHT_TOKENS.red.fg);
    expect(confidenceToken("N/D")).toBeNull();
    expect(Object.keys(CONFIDENCE_TOKENS)).toHaveLength(3);
  });
});
