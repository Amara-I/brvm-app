export const scoreSignal = {
  scoreTitle: "Quality score {score}/100 — {tier}. The score rates the company; it does not say when to buy.",
  confidenceAria: "Signal confidence: {value}",
  legendScore: "Score",
  legendScoreTitle: "Quality score 0–100: ≥ 70 Excellent (green), 55–69 Good (light green), 40–54 Average (amber), < 40 Weak (red).",
  legendSignal: "Signal",
  legendSignalTitle: "Technical signal (timing): ▲ Buy in green, ● Hold in amber, ▼ Reduce in orange, ▼ Sell in red.",
  legendConfidence: "Confidence",
  legendConfidenceTitle: "Signal confidence: green dot (high), amber (medium) or red (low).",
  qualityScore: "Quality score",
  technicalSignal: "Technical signal",
  conclusionNote: "The score rates the company's quality; the signal reads price timing. Both use the same green-to-red colour scale. The fundamental conclusion below does not recompute them.",
  tier: {
    excellent: "Score ≥ 70: Excellent",
    good: "Score 55–69: Good",
    average: "Score 40–54: Average",
    weak: "Score < 40: Weak",
  },
} as const;
