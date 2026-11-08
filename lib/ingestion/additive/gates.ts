// Gardes partagées par `GET /api/cron/enrich-history` et par le lot quotidien
// enchaîné après l'ingestion. L'écriture reste opt-in : un cron ne doit pas
// persister tant que la simulation n'a pas été validée.

export function additiveApplyAllowed(
  apply: "0" | "1",
  exchange: "BRVM" | "NGX"
): { ok: true } | { ok: false; reason: string } {
  if (apply === "1" && process.env.INGESTION_ADDITIVE_ENABLED !== "true") {
    return { ok: false, reason: "INGESTION_ADDITIVE_ENABLED doit être activé explicitement après simulation" };
  }
  const sourceFlag = exchange === "BRVM" ? "INGESTION_ADDITIVE_BRVM" : "INGESTION_ADDITIVE_NGX";
  if (process.env[sourceFlag] === "false") return { ok: false, reason: "Source désactivée" };
  return { ok: true };
}
