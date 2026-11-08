// Point d'extension du cron du lundi 06:00 UTC (`GET /api/cron/research`).
//
// Une prochaine fonctionnalité enverra ce jour-là l'e-mail hebdomadaire de
// propositions de portefeuille. Le branchement se fait dans
// `runWeeklyPortfolioProposals` : le cron l'appelle déjà, après la veille,
// et un échec ici ne fait pas échouer la veille.

export interface WeeklyPortfolioProposalsResult {
  /** true seulement quand l'envoi a réellement été exécuté. */
  ran: boolean;
  skipped: boolean;
  reason: string;
}

export function isWeeklyProposalsDay(now: Date): boolean {
  return now.getUTCDay() === 1;
}

export async function runWeeklyPortfolioProposals(
  now: Date = new Date()
): Promise<WeeklyPortfolioProposalsResult> {
  if (!isWeeklyProposalsDay(now)) {
    return {
      ran: false,
      skipped: true,
      reason: "hors lundi UTC — l'e-mail de propositions de portefeuille ne part que le lundi",
    };
  }
  return {
    ran: false,
    skipped: true,
    reason: "e-mail hebdomadaire de propositions de portefeuille non branché",
  };
}
