export const scoreSignal = {
  scoreTitle: "Score qualité {score}/100 — {tier}. Le score note la société ; il ne dit pas quand acheter.",
  confidenceAria: "Confiance du signal : {value}",
  legendScore: "Score",
  legendScoreTitle: "Score qualité 0–100 : ≥ 70 Excellent (vert), 55–69 Bon (vert clair), 40–54 Moyen (ambre), < 40 Faible (rouge).",
  legendSignal: "Signal",
  legendSignalTitle: "Signal technique (timing) : ▲ Acheter en vert, ● Conserver en ambre, ▼ Alléger en orange, ▼ Vendre en rouge.",
  legendConfidence: "Confiance",
  legendConfidenceTitle: "Confiance du signal : point vert (élevée), ambre (moyenne) ou rouge (faible).",
  qualityScore: "Score qualité",
  technicalSignal: "Signal technique",
  conclusionNote: "Le score juge la qualité de la société ; le signal lit le timing du cours. Tous deux utilisent le même code couleur, du vert (bon) au rouge (moins bon). La conclusion fondamentale ci-dessous ne les recalcule pas.",
  tier: {
    excellent: "Score ≥ 70 : Excellent",
    good: "Score 55–69 : Bon",
    average: "Score 40–54 : Moyen",
    weak: "Score < 40 : Faible",
  },
} as const;
