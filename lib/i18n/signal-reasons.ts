import { SIGNAL_REASON_CODES, type SignalReasonCode } from "@/lib/calc/signal-reason-codes";

export const SIGNAL_REASON_EN: Record<SignalReasonCode, string> = {
  "technical.short": "Short-term technicals: {note}",
  "perf5.strong": "Strong 5-year performance ({value}%), the main driver of the score.",
  "perf5.positive": "Positive 5-year performance ({value}%).",
  "perf5.weak": "Modest 5-year performance ({value}%).",
  "perf5.negative": "Negative 5-year performance ({value}%).",
  "perf.shortHistory": "Short history ({years} {yearsWord}): available performance {span}% (reduced weight).",
  "perf.unavailable": "Multi-year performance cannot be calculated (insufficient history) — criterion not scored.",
  "yield.attractive": "Attractive dividend yield ({yield}%).",
  "yield.attractiveCapped":
    "Attractive dividend yield ({yield}%). Note: exceptional level, contribution capped.",
  "yield.moderate": "Moderate dividend yield ({yield}%).",
  "yield.none": "No current dividend detected (yield 0%).",
  "div.none": "No known dividend year over the period.",
  "div.regular": "Regular dividends ({count} of {window} years).",
  "div.irregular": "Irregular dividends or partial history ({count}/{window} years).",
  "per.missing": "P/E unavailable or not meaningful — valuation not scored.",
  "per.extreme": "Extreme P/E ({per}): valuation hard to read or potentially distorted.",
  "per.low": "Low P/E ({per}): attractive valuation.",
  "per.fair": "Reasonable P/E ({per}).",
  "per.average": "P/E around the market average ({per}).",
  "per.high": "High P/E ({per}): expensive relative to earnings.",
  "per.veryHigh": "Very high P/E ({per}).",
  "vol.low": "Contained volatility ({vol}%) → low risk.",
  "vol.mid": "Moderate volatility ({vol}%) → medium risk.",
  "vol.high": "High volatility ({vol}%) → high risk.",
  "vol.unknown": "Risk cannot be assessed (history too short to measure volatility).",
  "risk.manage": "Risk management: {tier} ({score}/100).",
  "horizons":
    "Horizons — short {court}/100 · medium {moyen}/100 · long {long}/100 (tech. {tech}, fund. {fund}).",
  "confidence.cappedExtreme":
    "{confidence} confidence ({years} {yearsWord} of prices): extreme signal moderated.",
  "confidence.cappedBuy": "{confidence} confidence: signal capped at BUY (history still partial).",
  "confidence.ok": "{confidence} confidence in the analysis ({years} {yearsWord} of prices).",
};

void SIGNAL_REASON_CODES;
