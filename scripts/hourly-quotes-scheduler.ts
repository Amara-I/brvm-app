// Scheduler local : actualise les cours BRVM toutes les heures.
// Usage : npm run quotes:hourly
//
// En production Vercel, le même endpoint est appelé par le cron
// `0 * * * *` → GET /api/cron/refresh-quotes (cf. vercel.json).
// Ce script couvre le Docker / next dev local où Vercel Cron n'existe pas.

const INTERVAL_MS = 60 * 60 * 1000;

function baseUrl(): string {
  return (process.env.QUOTES_SCHEDULER_BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
}

function secret(): string {
  const s = process.env.CRON_SECRET;
  if (!s) {
    console.error("[quotes:hourly] CRON_SECRET manquant dans l'environnement.");
    process.exit(1);
  }
  return s;
}

async function tick(label: string): Promise<void> {
  const url = `${baseUrl()}/api/cron/refresh-quotes?secret=${encodeURIComponent(secret())}`;
  const started = Date.now();
  console.log(`[quotes:hourly] ${label} → ${baseUrl()}/api/cron/refresh-quotes`);
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; data?: { quotesFetched?: number; durationMs?: number; errors?: string[] }; error?: string }
      | null;
    const ms = Date.now() - started;
    if (!res.ok || !body?.ok) {
      console.error(`[quotes:hourly] ÉCHEC HTTP ${res.status} (${ms} ms)`, body?.error ?? body);
      return;
    }
    console.log(
      `[quotes:hourly] OK — ${body.data?.quotesFetched ?? "?"} cours en ${body.data?.durationMs ?? ms} ms`,
      body.data?.errors?.length ? `erreurs: ${body.data.errors.join(" ; ")}` : ""
    );
  } catch (err) {
    console.error(`[quotes:hourly] Erreur réseau (${Date.now() - started} ms):`, err);
  }
}

async function main(): Promise<void> {
  console.log(
    `[quotes:hourly] Démarrage — actualisation immédiate puis toutes les ${INTERVAL_MS / 60_000} min (Ctrl+C pour arrêter).`
  );
  await tick("run immédiat");
  setInterval(() => {
    void tick("run planifié");
  }, INTERVAL_MS);
}

void main();
