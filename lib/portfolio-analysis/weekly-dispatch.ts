import type { EmitNotificationInput, EmitResult } from "@/lib/notifications/emit";
import { emitNotification } from "@/lib/notifications/emit";
import { getPrefsMap } from "@/lib/notifications/prefs";
import { DEFAULT_PREFS, type PrefsSnapshot } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";
import type { PortfolioAnalysis } from "./analyze";
import { loadAnalysesForUsers, loadMarketContext } from "./load";
import { weeklyProposalBody, weeklyProposalTitle } from "./notify-copy";

export const WEEKLY_PROPOSAL_KIND = "weekly_portfolio_proposals";

export interface WeeklyDispatchStats {
  users: number;
  notified: number;
  optedOut: number;
  duplicates: number;
  errors: number;
}

export interface WeeklyDispatchDeps {
  listUserIds: () => Promise<string[]>;
  loadPrefs: (userIds: string[]) => Promise<Map<string, PrefsSnapshot>>;
  alreadySent: (userId: string, week: string) => Promise<boolean>;
  loadAnalyses: (userIds: string[]) => Promise<Map<string, PortfolioAnalysis[]>>;
  emit: (input: EmitNotificationInput) => Promise<EmitResult>;
}

function weekKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function defaultDeps(): Promise<WeeklyDispatchDeps> {
  return {
    listUserIds: async () => {
      const rows = await prisma.user.findMany({
        where: { portfolios: { some: { holdings: { some: {} } } } },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      return rows.map((row) => row.id);
    },
    loadPrefs: (userIds) => getPrefsMap(userIds),
    alreadySent: async (userId, week) => {
      const existing = await prisma.notificationEvent.findFirst({
        where: {
          userId,
          type: "PORTEFEUILLE",
          createdAt: { gte: new Date(`${week}T00:00:00.000Z`) },
          payload: { path: ["kind"], equals: WEEKLY_PROPOSAL_KIND },
        },
        select: { id: true },
      });
      return Boolean(existing);
    },
    loadAnalyses: async (userIds) => {
      const market = await loadMarketContext();
      return loadAnalysesForUsers(userIds, market);
    },
    emit: (input) => emitNotification(input),
  };
}

/**
 * Lundi UTC : une notification par compte qui a des lignes.
 * `portfolioEnabled` à false, ou les deux canaux coupés → rien n'est envoyé.
 * L'e-mail ne part que si le canal e-mail est déjà activé (défaut : non).
 * Heures calmes et mode digest restent ceux de `emitNotification`.
 */
export async function dispatchWeeklyPortfolioProposals(
  now: Date,
  deps?: WeeklyDispatchDeps
): Promise<WeeklyDispatchStats> {
  const gate = deps ?? (await defaultDeps());
  const stats: WeeklyDispatchStats = { users: 0, notified: 0, optedOut: 0, duplicates: 0, errors: 0 };
  const userIds = await gate.listUserIds();
  stats.users = userIds.length;
  if (userIds.length === 0) return stats;

  const prefs = await gate.loadPrefs(userIds);
  const week = weekKey(now);
  const eligible: string[] = [];
  for (const userId of userIds) {
    const pref = prefs.get(userId) ?? DEFAULT_PREFS;
    if (!pref.portfolioEnabled || (!pref.channelInApp && !pref.channelEmail)) {
      stats.optedOut += 1;
      continue;
    }
    if (await gate.alreadySent(userId, week)) {
      stats.duplicates += 1;
      continue;
    }
    eligible.push(userId);
  }

  let analyses = new Map<string, PortfolioAnalysis[]>();
  if (eligible.length > 0) {
    try {
      analyses = await gate.loadAnalyses(eligible);
    } catch (err) {
      console.error("[portfolio-analysis] chargement hebdomadaire", err);
      stats.errors = eligible.length;
      return stats;
    }
  }

  for (const userId of eligible) {
    try {
      const list = analyses.get(userId) ?? [];
      if (list.length === 0) continue;
      const pref = prefs.get(userId) ?? DEFAULT_PREFS;
      const result = await gate.emit({
        userId,
        type: "PORTEFEUILLE",
        title: weeklyProposalTitle(week),
        body: weeklyProposalBody(list),
        href: "/portefeuille/analyse",
        payload: { kind: WEEKLY_PROPOSAL_KIND, week },
        prefs: pref,
        now,
      });
      if (result.created) stats.notified += 1;
      else stats.optedOut += 1;
    } catch (err) {
      stats.errors += 1;
      console.error(`[portfolio-analysis] notification ${userId}`, err instanceof Error ? err.message : err);
    }
  }
  return stats;
}
