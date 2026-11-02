import type { PrismaClient } from "@prisma/client";

export const MONTHLY_LIMIT_CENTS = 2500; // Autorisation utilisateur : 25 EUR, jamais augmentée via une variable.
export const BUDGET_KIND = "FINANCE_AGENT_RESERVATION_V1";
export interface CostEnvelope { model: string; provider: string; inputEurPerMillion: number; outputEurPerMillion: number; expiresAt: string }

/** Enveloppe EUR tout compris (FX, taxes et frais), vérifiée par l'opérateur + plafond fournisseur obligatoire. */
export function costEnvelope(env: Record<string, string | undefined> = process.env, now = new Date()): CostEnvelope | null {
  if (env.FINANCE_AGENT_PROVIDER_CAP_VERIFIED !== "true") return null;
  const model = env.FINANCE_AGENT_MODEL?.trim();
  const provider = env.FINANCE_AGENT_PROVIDER?.trim();
  const input = Number(env.FINANCE_AGENT_INPUT_EUR_PER_MILLION);
  const output = Number(env.FINANCE_AGENT_OUTPUT_EUR_PER_MILLION);
  const expiresAt = env.FINANCE_AGENT_PRICE_VALID_UNTIL ?? "";
  const expiry = Date.parse(expiresAt);
  if (!model || !/^[a-z0-9-]+\/[a-z0-9._-]+$/.test(model) || model.startsWith("vmc/") || !provider || !/^[a-z0-9-]+$/.test(provider) || !Number.isFinite(input) || input <= 0 || !Number.isFinite(output) || output <= 0 ||
    !Number.isFinite(expiry) || expiry <= now.getTime() || expiry > now.getTime() + 31 * 86400000) return null;
  return { model, provider, inputEurPerMillion: input, outputEurPerMillion: output, expiresAt };
}

/** Majorant conservateur, pas une mesure de facture. Réservation intégralement consommée, même sur erreur. */
export function reservationCents(inputBytes: number, outputTokens: number, price: CostEnvelope): number {
  const inputTokenCeiling = inputBytes + 16000; // UTF-8 + système/schéma/encapsulation ; requête texte seulement.
  return Math.max(5, Math.ceil(((inputTokenCeiling * price.inputEurPerMillion + outputTokens * price.outputEurPerMillion) / 1e6) * 100 * 2));
}
export function monthWindow(now: Date) {
  return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}
export function spentCents(rows: { errors: unknown }[]): number {
  return rows.reduce((sum, r) => {
    const payload = r.errors as { kind?: string; cents?: number } | null;
    if (payload?.kind !== BUDGET_KIND) return sum;
    // État comptable invalide = arrêt sûr, jamais remise à zéro implicite.
    return sum + (Number.isInteger(payload.cents) && payload.cents! > 0 ? payload.cents! : MONTHLY_LIMIT_CENTS);
  }, 0);
}

export async function reserveBudget(db: PrismaClient, cents: number, job: string, now = new Date()): Promise<boolean> {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MONTHLY_LIMIT_CENTS) return false;
  const window = monthWindow(now);
  return db.$transaction(async (tx) => {
    // Même verrou pour chaque processus et chaque job : deux crons ne peuvent consommer le même solde.
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(73491826)");
    const rows = await tx.ingestionLog.findMany({ where: { source: "MANUEL", runAt: { gte: window.start, lt: window.end } }, select: { errors: true } });
    if (spentCents(rows) + cents > MONTHLY_LIMIT_CENTS) return false;
    await tx.ingestionLog.create({ data: { source: "MANUEL", status: "SUCCESS", finishedAt: now,
      errors: { kind: BUDGET_KIND, cents, currency: "EUR", job, month: window.start.toISOString().slice(0, 7) } } });
    return true;
  }, { timeout: 10000 });
}
