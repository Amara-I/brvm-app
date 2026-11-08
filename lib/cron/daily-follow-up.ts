// Suivi du cron de clôture (17:00 UTC), dans la MÊME invocation que l'ingestion.
//
// Le plan Hobby n'accepte que 2 crons, chacun au plus une fois par jour.
// L'agent financier (autrefois 05:15 UTC) et les quatre files additives
// (autrefois plusieurs fois par heure) tournent donc ici, après que les
// cours du jour sont persistés. Chaque étape est isolée : un échec est
// journalisé et n'interrompt ni l'ingestion (déjà terminée) ni les étapes
// suivantes.
//
// Pourquoi 17:00 et pas le lundi 06:00 : l'agent financier ne lit pas les
// cours de la séance. Il parcourt des lacunes de comptes déjà clos, un
// catalogue officiel et au plus un PDF, pour une revue humaine. Le garder
// dans le créneau du lundi le passerait de quotidien à hebdomadaire. 05:15
// n'était utile que comme cron séparé, avant l'ouverture, pour ne pas
// partager le plafond de 300 s. Ce plafond est maintenant partagé. La réserve
// n'est retirée aux 240 s d'ingestion que si l'agent ou l'écriture additive
// est armé. L'agent s'arrête sur un délai qu'il respecte.
//
// Le lot additif reprend le curseur `ADDITIVE_ENRICHMENT` (idempotent,
// insertions seules). Il grossit tant que le temps de l'étape le permet,
// au lieu des petits `limit` répétés toute la journée.

import { additiveApplyAllowed } from "@/lib/ingestion/additive/gates";
import { DEFAULT_VERCEL_INGEST_BUDGET_MS, createTimeBudget } from "@/lib/ingestion/time-budget";

export const HOBBY_FUNCTION_MAX_MS = 300_000;
export const CRON_RESPONSE_MARGIN_MS = 12_000;
/** Un passage d'agent : catalogue borné + découverte, ou l'IA si le délai le permet. */
export const FINANCE_AGENT_DAILY_CAP_MS = 40_000;
/**
 * En dessous, `runAdditiveEnrichment` ne démarre aucune unité : il garde
 * 15 s avant sa propre échéance. 18 s laisse une requête courte aboutir.
 */
export const MIN_ENRICH_STEP_MS = 18_000;
export const ENRICH_CALL_LIMIT = 10;
export const ENRICH_CALLS_PER_STEP = 8;

export const DAILY_ENRICH_JOBS = [
  { exchange: "BRVM", kind: "history" },
  { exchange: "NGX", kind: "history" },
  { exchange: "BRVM", kind: "publications" },
  { exchange: "NGX", kind: "publications" },
] as const;

/** Réserve maximale : agent actif et les quatre files additives autorisées. */
export const DAILY_FOLLOW_UP_RESERVE_MS = FINANCE_AGENT_DAILY_CAP_MS + MIN_ENRICH_STEP_MS * DAILY_ENRICH_JOBS.length;

/**
 * Temps à laisser après l'ingestion. Un job désactivé revient tout de suite :
 * on ne raccourcit pas les 240 s historiques pour un simple contrôle de flag.
 * Les files additives n'entrent dans la réserve que si l'écriture est armée.
 */
export function scheduledFollowUpReserveMs(env: Record<string, string | undefined>): number {
  const financeMs = env.FINANCE_AGENT_ENABLED === "true" ? FINANCE_AGENT_DAILY_CAP_MS : 0;
  if (env.INGESTION_ADDITIVE_ENABLED !== "true") return financeMs;
  const jobs = DAILY_ENRICH_JOBS.filter((job) => {
    const flag = job.exchange === "BRVM" ? "INGESTION_ADDITIVE_BRVM" : "INGESTION_ADDITIVE_NGX";
    return env[flag] !== "false";
  });
  return financeMs + MIN_ENRICH_STEP_MS * jobs.length;
}

export interface FollowUpStepLog {
  name: string;
  durationMs: number;
  skipped: boolean;
  reason?: string;
  calls?: number;
  items?: number;
}

export interface DailyFollowUpSummary {
  budgetMs: number;
  steps: FollowUpStepLog[];
}

export interface DailyEnrichCall {
  exchange: "BRVM" | "NGX";
  kind: "history" | "publications";
  apply: "1";
  limit: number;
  budgetMs: number;
  from: string;
}

export interface DailyEnrichResult {
  incomplete?: boolean;
  failed?: boolean;
  results?: unknown[];
  next?: number;
  total?: number;
}

type FinanceRunner = (deadlineMs: number) => Promise<unknown>;
type EnrichRunner = (input: DailyEnrichCall) => Promise<DailyEnrichResult>;

export function dailyIngestBudgetMs(
  env: Record<string, string | undefined> = process.env,
  maxDurationMs = HOBBY_FUNCTION_MAX_MS
): number {
  const usable = maxDurationMs - CRON_RESPONSE_MARGIN_MS;
  const room = Math.max(60_000, usable - scheduledFollowUpReserveMs(env));
  // Plafond historique : au-delà de 240 s, un dépassement interne touche le kill à 300 s.
  const cap = Math.min(DEFAULT_VERCEL_INGEST_BUDGET_MS, room);
  const fromEnv = Number(env.INGESTION_CRON_BUDGET_MS);
  if (env.INGESTION_CRON_BUDGET_MS != null && env.INGESTION_CRON_BUDGET_MS !== "" && Number.isFinite(fromEnv) && fromEnv >= 5_000) {
    return Math.min(Math.floor(fromEnv), cap);
  }
  return cap;
}

function stepName(exchange: string, kind: string): string {
  return `enrich:${exchange}:${kind}`;
}

async function defaultFinance(deadlineMs: number): Promise<unknown> {
  const { runFinanceAgent } = await import("@/lib/finance-agent/run");
  return runFinanceAgent(undefined, { deadlineMs });
}

async function defaultEnrich(input: DailyEnrichCall): Promise<DailyEnrichResult> {
  const { runAdditiveEnrichment } = await import("@/lib/ingestion/additive/run");
  return runAdditiveEnrichment(input);
}

export async function runDailyAfterClose(input: {
  startedAtMs: number;
  maxDurationMs?: number;
  now?: () => number;
  logger?: (line: string) => void;
  runFinance?: FinanceRunner;
  runEnrich?: EnrichRunner;
} ): Promise<DailyFollowUpSummary> {
  const now = input.now ?? Date.now;
  const logger = input.logger ?? ((line: string) => console.log(line));
  const runFinance = input.runFinance ?? defaultFinance;
  const runEnrich = input.runEnrich ?? defaultEnrich;
  const wallDeadline = input.startedAtMs + (input.maxDurationMs ?? HOBBY_FUNCTION_MAX_MS) - CRON_RESPONSE_MARGIN_MS;
  const budget = createTimeBudget(Math.max(0, wallDeadline - now()), now);
  const steps: FollowUpStepLog[] = [];

  const note = (step: FollowUpStepLog) => {
    steps.push(step);
    const reason = step.reason ? ` reason=${step.reason}` : "";
    logger(`[daily] step=${step.name} durationMs=${step.durationMs} skipped=${step.skipped}${reason}`);
  };

  const financeStarted = now();
  const financeBudget = Math.min(FINANCE_AGENT_DAILY_CAP_MS, budget.remainingMs());
  if (financeBudget < 5_000) {
    note({
      name: "finance-agent",
      durationMs: 0,
      skipped: true,
      reason: `reste ${Math.max(0, financeBudget)}ms < 5000ms`,
    });
  } else {
    try {
      const data = await runFinance(now() + financeBudget);
      const aiStatus = data && typeof data === "object" && "aiStatus" in data ? String(data.aiStatus) : undefined;
      note({
        name: "finance-agent",
        durationMs: now() - financeStarted,
        skipped: false,
        reason: aiStatus,
      });
    } catch (err) {
      note({
        name: "finance-agent",
        durationMs: now() - financeStarted,
        skipped: false,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let poolMs = Math.max(0, budget.remainingMs());
  for (let i = 0; i < DAILY_ENRICH_JOBS.length; i++) {
    const job = DAILY_ENRICH_JOBS[i]!;
    const name = stepName(job.exchange, job.kind);
    const gate = additiveApplyAllowed("1", job.exchange);
    if (!gate.ok) {
      note({ name, durationMs: 0, skipped: true, reason: gate.reason });
      continue;
    }
    if (poolMs < MIN_ENRICH_STEP_MS || !budget.canStart(MIN_ENRICH_STEP_MS)) {
      note({
        name,
        durationMs: 0,
        skipped: true,
        reason: `reste ${Math.max(0, Math.floor(Math.min(poolMs, budget.remainingMs())))}ms < ${MIN_ENRICH_STEP_MS}ms`,
      });
      continue;
    }

    const slots = DAILY_ENRICH_JOBS.length - i;
    let share = Math.floor(poolMs / slots);
    if (share < MIN_ENRICH_STEP_MS) share = MIN_ENRICH_STEP_MS;
    share = Math.min(share, Math.floor(budget.remainingMs()));
    const stepStart = now();
    const stepDeadline = stepStart + share;
    let calls = 0;
    let items = 0;
    let reason: string | undefined;
    try {
      while (calls < ENRICH_CALLS_PER_STEP) {
        const remainStep = stepDeadline - now();
        if (remainStep < MIN_ENRICH_STEP_MS || !budget.canStart(MIN_ENRICH_STEP_MS)) break;
        const budgetMs = Math.min(240_000, Math.floor(remainStep));
        calls += 1;
        const summary = await runEnrich({
          exchange: job.exchange,
          kind: job.kind,
          apply: "1",
          limit: ENRICH_CALL_LIMIT,
          budgetMs,
          from: "2006-01-01",
        });
        const batch = summary.results?.length ?? 0;
        items += batch;
        if (summary.failed) {
          reason = "fenêtre en échec ou en quarantaine — curseur conservé";
          break;
        }
        if (!summary.incomplete) {
          reason = "file terminée";
          break;
        }
        if (batch < ENRICH_CALL_LIMIT) break;
      }
      note({ name, durationMs: now() - stepStart, skipped: false, reason, calls, items });
    } catch (err) {
      note({
        name,
        durationMs: now() - stepStart,
        skipped: false,
        reason: err instanceof Error ? err.message : String(err),
        calls,
        items,
      });
    }
    poolMs = Math.max(0, poolMs - (now() - stepStart));
  }

  return { budgetMs: budget.totalMs, steps };
}
