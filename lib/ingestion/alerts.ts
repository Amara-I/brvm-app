// ═══════════════════════════════════════════════════════════════════════════
// Alerting d'ingestion — étape 6 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Best-effort par conception : une alerte qui échoue à s'envoyer NE DOIT
// JAMAIS faire échouer le run d'ingestion lui-même (cf. `runFullIngestion`).
// Toujours logguée en console (visible dans les logs Vercel / la sortie du
// script CLI), et en plus relayée vers un webhook générique compatible
// Slack/Discord/Teams (payload `{ text }`) si `INGESTION_ALERT_WEBHOOK_URL`
// est configuré (cf. .env.example). Aucune dépendance à un fournisseur
// spécifique : n'importe quel outil peut être branché en réécrivant l'appel
// fetch ci-dessous.
// ═══════════════════════════════════════════════════════════════════════════

export type AlertSeverity = "info" | "warning" | "critical";

export interface IngestionAlert {
  severity: AlertSeverity;
  title: string;
  message: string;
}

const SEVERITY_ICON: Record<AlertSeverity, string> = {
  info: "🔵",
  warning: "🟠",
  critical: "🔴",
};

export async function sendIngestionAlert(alert: IngestionAlert): Promise<void> {
  const icon = SEVERITY_ICON[alert.severity];
  // Toujours logué, même sans webhook configuré — c'est le strict minimum
  // pour qu'un échec soit visible dans les logs de la plateforme d'hébergement.
  console.log(`${icon} [ingestion-alert:${alert.severity}] ${alert.title} — ${alert.message}`);

  const webhookUrl = process.env.INGESTION_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${icon} *${alert.title}*\n${alert.message}` }),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    console.error("⚠ Échec d'envoi de l'alerte webhook (ignoré, l'ingestion continue) :", err instanceof Error ? err.message : err);
  }
}
