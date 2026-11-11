export const scoreSignal = {
  scoreTitle: "Score qualité {score}/100 — {tier}. Le score note la société (or/bleu) ; il ne dit pas quand acheter.",
  confidenceAria: "Confiance du signal : {value}",
  legendScore: "Score",
  legendScoreTitle: "Score qualité 0–100 : ≥ 70 Excellent, 55–69 Bon, 40–54 Moyen, < 40 Faible. Échelle or/bleu, indépendante du signal.",
  legendSignal: "Signal",
  legendSignalTitle: "Signal technique (timing) : ▲ Acheter en vert, ● Conserver en ambre, ▼ Alléger/Vendre en orange/rouge.",
  legendConfidence: "Confiance",
  legendConfidenceTitle: "Confiance du signal : plus le point est pâle, plus la lecture est fragile (données ou liquidité limitées).",
  qualityScore: "Score qualité",
  technicalSignal: "Signal technique",
  conclusionNote: "Le score (or/bleu) juge la qualité de la société ; le signal (vert/ambre/rouge) lit le timing du cours. La conclusion fondamentale ci-dessous ne les recalcule pas.",
  tier: {
    excellent: "Score ≥ 70 : Excellent",
    good: "Score 55–69 : Bon",
    average: "Score 40–54 : Moyen",
    weak: "Score < 40 : Faible",
  },
} as const;
