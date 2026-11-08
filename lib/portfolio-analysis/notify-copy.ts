import type { PortfolioAnalysis, ProposalAction, ReasonCode } from "./analyze";

const ACTION: Record<ProposalAction, string> = {
  ALLEGER: "Alléger",
  RENFORCER: "Renforcer",
  CONSERVER: "Conserver",
  SORTIR: "Sortir",
  SURVEILLER: "Surveiller",
};

const REASON: Record<ReasonCode, string> = {
  over_stock_limit: "poids du titre au-dessus du plafond indicatif",
  over_sector_limit: "secteur au-dessus du plafond indicatif",
  over_country_limit: "pays au-dessus du plafond indicatif",
  over_market_limit: "place au-dessus du plafond indicatif",
  illiquid_exit: "titre peu liquide, sortie difficile",
  above_risk_budget: "quantité au-dessus du budget de risque",
  rr_weak: "rapport rendement/risque inférieur à 1",
  rr_strong: "rapport rendement/risque favorable",
  stop_breached: "cours à l’invalidation ou en dessous",
  regime_risk_off: "régime de marché défavorable",
  below_suggested: "ligne sous la taille suggérée",
  unit_risk_too_wide: "invalidation trop loin pour le budget",
  plan_unavailable: "invalidation ou cours indisponible",
  fx_missing: "taux NGN/FCFA indisponible",
  liquidity_unknown: "volume quotidien non observé",
  aligned: "dans les repères",
};

function shares(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "N/D";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function weeklyProposalTitle(week: string): string {
  return `Propositions de portefeuille — semaine du ${week}`;
}

/** Texte français stocké en notification (le centre n’a pas de locale par compte). */
export function weeklyProposalBody(analyses: readonly PortfolioAnalysis[]): string {
  const lines: string[] = [];
  for (const analysis of analyses) {
    lines.push(analysis.portfolioName);
    const moves = analysis.proposals.filter((proposal) => proposal.action !== "CONSERVER");
    if (moves.length === 0) {
      lines.push("Aucune modification suggérée : les lignes restent dans les repères du profil.");
      continue;
    }
    for (const proposal of moves.slice(0, 6)) {
      const reason = proposal.reasons[0] ? REASON[proposal.reasons[0]] : "à relire";
      lines.push(
        `${ACTION[proposal.action]} ${proposal.ticker} — ${shares(proposal.currentShares)} → ${shares(proposal.suggestedShares)} titres. ${reason}.`
      );
    }
    if (moves.length > 6) lines.push(`… et ${moves.length - 6} autre(s) proposition(s) dans l’analyse.`);
  }
  lines.push("Recommandations seulement : la décision vous appartient. Ce n’est pas un conseil en investissement.");
  return lines.join("\n").slice(0, 1800);
}
