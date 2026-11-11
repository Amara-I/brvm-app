export const scoreSignal = {
  scoreTitle: "Quality score {score}/100 — {tier}. The score rates the company (gold/blue); it does not say when to buy.",
  confidenceAria: "Signal confidence: {value}",
  legendScore: "Score",
  legendScoreTitle: "Quality score 0–100: ≥ 70 Excellent, 55–69 Good, 40–54 Average, < 40 Weak. Gold/blue scale, independent of the signal.",
  legendSignal: "Signal",
  legendSignalTitle: "Technical signal (timing): ▲ Buy in green, ● Hold in amber, ▼ Reduce/Sell in orange/red.",
  legendConfidence: "Confidence",
  legendConfidenceTitle: "Signal confidence: the paler the dot, the weaker the reading (limited data or liquidity).",
  qualityScore: "Quality score",
  technicalSignal: "Technical signal",
  conclusionNote: "The score (gold/blue) rates the company's quality; the signal (green/amber/red) reads price timing. The fundamental conclusion below does not recompute them.",
  tier: {
    excellent: "Score ≥ 70: Excellent",
    good: "Score 55–69: Good",
    average: "Score 40–54: Average",
    weak: "Score < 40: Weak",
  },
} as const;
