// Cron du lundi 06:00 UTC (`GET /api/cron/research`).
// Après la veille, `runWeeklyPortfolioProposals` notifie les propositions
// de portefeuille (in-app, et e-mail si le canal est déjà activé).
// Un échec ici ne fait pas échouer la veille : la route l'isole.

export interface WeeklyPortfolioProposalsResult {
  /** true seulement quand l'envoi a réellement été exécuté. */
  ran: boolean;
  skipped: boolean;
  reason: string;
  users?: number;
  notified?: number;
  optedOut?: number;
  duplicates?: number;
  errors?: number;
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
      reason: "hors lundi UTC — les propositions de portefeuille ne partent que le lundi",
    };
  }
  const { dispatchWeeklyPortfolioProposals } = await import("@/lib/portfolio-analysis/weekly-dispatch");
  const stats = await dispatchWeeklyPortfolioProposals(now);
  return {
    ran: true,
    skipped: false,
    reason:
      stats.notified > 0
        ? `propositions notifiées : ${stats.notified}`
        : "aucune proposition notifiée",
    users: stats.users,
    notified: stats.notified,
    optedOut: stats.optedOut,
    duplicates: stats.duplicates,
    errors: stats.errors,
  };
}
