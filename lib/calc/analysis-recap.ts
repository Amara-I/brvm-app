/** Helpers d'affichage pour les récaps d'analyse (liste + graphes). */

import type { CalcMetricsResult } from "@/lib/calc/calc-metrics";

function nd(v: string | number | null | undefined): string {
  if (v == null || v === "" || v === "N/D") return "N/D";
  return String(v);
}

export function fundamentalRecapLines(m: CalcMetricsResult, per?: number): string[] {
  const lines: string[] = [];

  const perTxt = per != null && per > 0 ? per.toFixed(1).replace(".", ",") : "N/D";
  lines.push(`Dividende : rendement ${nd(m.dividendYieldPercent)}% · PER ${perTxt}`);

  const risk = m.riskAnalysis;
  lines.push(
    `Risque : ${risk.riskTier} (${risk.riskScore}/100)` +
      (m.volatilityPercent !== "N/D" ? ` · volatilité ${m.volatilityPercent}%` : "")
  );

  lines.push(
    `Horizons C/M/L : ${m.horizonScores.court} / ${m.horizonScores.moyen} / ${m.horizonScores.long}` +
      ` · fond. ${m.fundamentalScore}/100`
  );

  const top = m.signalReasons.filter((r) => r.kind !== "neutre").slice(0, 2);
  for (const r of top) {
    lines.push(`${r.kind === "positif" ? "▲" : "▼"} ${r.text}`);
  }

  return lines.slice(0, 5);
}

export function technicalRecapLines(input: {
  technical: CalcMetricsResult["technical"];
  technicalScore: number;
}): string[] {
  const t = input.technical;
  const lines: string[] = [];

  if (!t.available) {
    return [
      "Indicateurs techniques N/D (historique trop court pour RSI / MACD / SMA).",
      `Score technique ${input.technicalScore}/100 (repli sur horizons de cours).`,
    ];
  }

  lines.push(
    `Score technique ${input.technicalScore}/100` +
      (t.shortTermScore != null ? ` · court terme ${t.shortTermScore}/100` : "")
  );

  lines.push(
    `RSI 14 : ${t.rsi14 != null ? String(t.rsi14).replace(".", ",") : "N/D"}` +
      ` · MACD hist. : ${t.macd ? String(t.macd.histogram).replace(".", ",") : "N/D"}`
  );

  const cross =
    t.maCross === "golden_cross"
      ? "croisement haussier (SMA)"
      : t.maCross === "death_cross"
        ? "croisement baissier (SMA)"
        : t.maCross === "none"
          ? "pas de croisement récent"
          : "N/D";

  lines.push(
    `SMA10 ${t.sma10 != null ? Math.round(t.sma10).toLocaleString("fr-FR") : "N/D"}` +
      ` · SMA20 ${t.sma20 != null ? Math.round(t.sma20).toLocaleString("fr-FR") : "N/D"}` +
      ` · SMA50 ${t.sma50 != null ? Math.round(t.sma50).toLocaleString("fr-FR") : "N/D"}` +
      ` · ${cross}`
  );

  for (const note of t.notes.slice(0, 2)) {
    lines.push(note);
  }

  return lines.slice(0, 5);
}

export function truncateSummary(text: string, max = 180): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}
