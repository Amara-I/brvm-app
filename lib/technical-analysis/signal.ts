// Signal ACHAT FORT … VENDRE issu uniquement du timing technique : un déclencheur
// d'entrée daté (entry-triggers.ts), modulé par le score de timing et la confiance.
// Le score qualité (calcMetrics) n'entre pas dans le libellé.

import type { SignalReason, TradeSignal } from "@/lib/calc/calc-metrics";
import { signalOf } from "@/lib/calc/calc-metrics";
import type { SignalReasonCode } from "@/lib/calc/signal-reason-codes";
import { formatPrice } from "./level-label";
import type { EntryState } from "./entry-triggers";
import type { TimingAssessment } from "./timing";
import type { ConfidenceLevel, StructureSnapshot, TechnicalAnalysis, TechnicalSignal } from "./types";

const SIGNAL_RANK: Record<TradeSignal["label"], number> = {
  "ACHAT FORT": 2,
  ACHAT: 1,
  CONSERVER: 0,
  ALLÉGER: -1,
  VENDRE: -2,
};

function downgrade(label: TradeSignal["label"]): TradeSignal["label"] {
  if (label === "ACHAT FORT") return "ACHAT";
  if (label === "VENDRE") return "ALLÉGER";
  return label;
}

function confidenceFor(bars: number, label: TradeSignal["label"], structure: StructureSnapshot, illiquid: boolean): ConfidenceLevel {
  if (illiquid || bars < 40) return "Faible";
  const aligned =
    (label === "ACHAT FORT" || label === "ACHAT") && structure.bias === "bullish"
      ? true
      : (label === "VENDRE" || label === "ALLÉGER") && structure.bias === "bearish"
        ? true
        : label === "CONSERVER";
  if (bars >= 120 && aligned && structure.atr14 != null) return "Élevée";
  if (bars >= 60) return "Moyenne";
  return "Faible";
}

/** Seuil du score de timing pour un signal fort (ACHAT FORT / VENDRE). */
export const STRONG_TIMING = 40;

export function decideSignal(
  assessment: TimingAssessment | number,
  structure: StructureSnapshot,
  bars: number,
  illiquid: boolean,
  entry?: EntryState
): TechnicalSignal {
  const timing = typeof assessment === "number" ? assessment : assessment.score;
  const rsi = structure.rsi14;
  let label: TradeSignal["label"] = "CONSERVER";
  if (entry) {
    // Le libellé naît d'un déclencheur daté (repli, cassure, retournement), pas d'un
    // empilement de moyennes déjà croisées. Fort seulement si la tendance confirme.
    if (entry.side === 1) {
      label =
        entry.stage === "confirmed" && structure.bias === "bullish" && timing >= STRONG_TIMING && (rsi == null || rsi < 72)
          ? "ACHAT FORT"
          : "ACHAT";
    } else if (entry.side === -1) {
      label =
        entry.stage === "confirmed" && structure.bias === "bearish" && timing <= -STRONG_TIMING && (rsi == null || rsi > 28)
          ? "VENDRE"
          : "ALLÉGER";
    }
  } else {
    if (timing >= 58 && structure.bias === "bullish" && (rsi == null || rsi < 72)) label = "ACHAT FORT";
    else if (timing >= 26) label = "ACHAT";
    else if (timing <= -58 && structure.bias === "bearish" && (rsi == null || rsi > 28)) label = "VENDRE";
    else if (timing <= -26) label = "ALLÉGER";
  }

  let confidence = confidenceFor(bars, label, structure, illiquid);
  if (illiquid) {
    confidence = "Faible";
    if (Math.abs(timing) < 20) label = "CONSERVER";
    else if (SIGNAL_RANK[label] > 0) label = "ACHAT";
    else if (SIGNAL_RANK[label] < 0) label = "ALLÉGER";
  } else if (confidence !== "Élevée") {
    label = downgrade(label);
    if (confidence === "Faible" && (label === "ACHAT FORT" || label === "VENDRE")) label = downgrade(label);
  }
  if (confidence === "Faible" && !illiquid && (label === "ACHAT FORT" || label === "VENDRE")) {
    label = downgrade(label);
  }
  const stage = entry
    ? label === "CONSERVER"
      ? entry.stage === "extended"
        ? "extended"
        : "none"
      : entry.stage
    : "none";
  return {
    label,
    timingScore: timing,
    confidence,
    stage,
    entryKind: label === "CONSERVER" ? null : (entry?.kind ?? null),
    triggeredAt: label === "CONSERVER" ? null : (entry?.triggeredAt ?? null),
    extensionAtr: entry?.extensionAtr ?? null,
  };
}

function reason(
  kind: SignalReason["kind"],
  code: SignalReasonCode,
  text: string,
  params?: Record<string, string | number>
): SignalReason {
  return params ? { kind, code, text, params } : { kind, code, text };
}

const TRIGGER_TEXT: Record<"pullback" | "breakout" | "reversal", { buy: [string, string]; sell: [string, string] }> = {
  pullback: {
    buy: ["fin d'un repli dans une tendance haussière", "end of a pullback in an uptrend"],
    sell: ["fin d'un rebond dans une tendance baissière", "end of a rebound in a downtrend"],
  },
  breakout: {
    buy: ["cassure par le haut d'une base serrée de 20 séances", "breakout above a tight 20-session base"],
    sell: ["cassure par le bas d'une base serrée de 20 séances", "breakdown below a tight 20-session base"],
  },
  reversal: {
    buy: ["sortie de survente (RSI repassé au-dessus de 30)", "exit from oversold (RSI back above 30)"],
    sell: ["sortie de surachat (RSI repassé sous 70)", "exit from overbought (RSI back below 70)"],
  },
};

function frDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Raisons de timing : déclencheur daté, stade précoce, ou « trop tard ». */
export function timingReasons(signal: TechnicalAnalysis["signal"]): SignalReason[] {
  const out: SignalReason[] = [];
  const buy = signal.label === "ACHAT" || signal.label === "ACHAT FORT";
  const sell = signal.label === "ALLÉGER" || signal.label === "VENDRE";
  if ((buy || sell) && signal.entryKind && signal.triggeredAt) {
    const [fr, en] = TRIGGER_TEXT[signal.entryKind][buy ? "buy" : "sell"];
    out.push(
      reason(buy ? "positif" : "negatif", "ta.entry", `Déclencheur : ${fr}, le ${frDate(signal.triggeredAt)}.`, {
        trigger: en,
        date: signal.triggeredAt,
      })
    );
  }
  if (signal.stage === "early" && (buy || sell)) {
    out.push(
      reason(
        "neutre",
        "ta.early",
        "Signal précoce : le mouvement démarre, la tendance de fond n'est pas encore confirmée."
      )
    );
  } else if (signal.stage === "extended") {
    const atr = signal.extensionAtr == null ? null : Math.abs(signal.extensionAtr);
    out.push(
      reason(
        "neutre",
        "ta.extended",
        atr == null
          ? "Trop tard pour entrer : le cours a déjà bien avancé. On attend un repli vers la moyenne."
          : `Trop tard pour entrer : le cours est déjà à ${atr.toLocaleString("fr-FR")} ATR de sa moyenne 20 séances. On attend un repli.`,
        atr == null ? undefined : { atr }
      )
    );
  }
  return out;
}

export function signalReasons(analysis: TechnicalAnalysis): SignalReason[] {
  const { structure, liquidity, signal } = analysis;
  const currency = analysis.currency ?? "XOF";
  const reasons: SignalReason[] = [...timingReasons(signal)];
  if (structure.bias === "bullish") {
    reasons.push(reason("positif", "ta.structureBull", "Structure haussière : plus hauts et plus bas ascendants."));
  } else if (structure.bias === "bearish") {
    reasons.push(reason("negatif", "ta.structureBear", "Structure baissière : plus hauts et plus bas descendants."));
  } else {
    reasons.push(reason("neutre", "ta.structureRange", "Structure mixte : pas de séquence claire de plus hauts et plus bas."));
  }

  const rsi = structure.rsi14 == null ? "N/D" : String(structure.rsi14);
  const hist = structure.macdHistogram == null ? "N/D" : String(structure.macdHistogram);
  reasons.push(
    reason(
      structure.macdHistogram == null ? "neutre" : structure.macdHistogram > 0 ? "positif" : "negatif",
      "ta.momentum",
      `Momentum : RSI(14) ${rsi}, histogramme MACD ${hist}.`,
      { rsi, hist }
    )
  );

  const support = [...analysis.zones].filter((z) => z.kind === "support").sort((a, b) => b.strength - a.strength)[0];
  const resistance = [...analysis.zones].filter((z) => z.kind === "resistance").sort((a, b) => b.strength - a.strength)[0];
  const zone = signal.label === "ALLÉGER" || signal.label === "VENDRE" ? resistance ?? support : support ?? resistance;
  if (zone) {
    const code = zone.kind === "resistance" ? "ta.resistanceReaction" : "ta.supportReaction";
    const text =
      zone.kind === "resistance"
        ? `Résistance vers ${formatPrice(zone.mid, currency, "fr")} : ${zone.touches} tests, ${zone.bounces} rejets, ${zone.breaks} dépassements.`
        : `Support vers ${formatPrice(zone.mid, currency, "fr")} : ${zone.touches} tests, ${zone.bounces} rebonds, ${zone.breaks} cassures.`;
    reasons.push(
      reason(zone.bounces > zone.breaks ? "positif" : zone.breaks > zone.bounces ? "negatif" : "neutre", code, text, {
        price: formatPrice(zone.mid, currency, "en"),
        touches: zone.touches,
        bounces: zone.bounces,
        breaks: zone.breaks,
      })
    );
  }

  if (liquidity.warningFr && liquidity.warningEn) {
    reasons.push(reason("negatif", "ta.liquidity", liquidity.warningFr, { warning: liquidity.warningEn }));
  } else if (liquidity.bars < 40) {
    reasons.push(
      reason(
        "neutre",
        "ta.history",
        `Seulement ${liquidity.bars} clôtures journalières : la confiance reste basse.`,
        { bars: liquidity.bars }
      )
    );
  }
  return reasons;
}

export function technicalSummary(label: TradeSignal["label"], qualityScore: number, confidence: ConfidenceLevel, warningFr: string | null): string {
  const base = `Signal technique : ${label} (score qualité ${qualityScore}/100, confiance ${confidence}). Le score mesure la qualité de la société ; ce signal décrit le timing de court terme du cours.`;
  return warningFr ? `${base} ${warningFr}` : base;
}

export function toTradeSignal(label: TradeSignal["label"]): TradeSignal {
  return signalOf(label);
}
