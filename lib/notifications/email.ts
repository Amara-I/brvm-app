// Envoi e-mail optionnel via Resend HTTP. Pas de SMTP natif (pas de nodemailer).
// Si RESEND_API_KEY + EMAIL_FROM (ou RESEND_FROM) manquent, on ignore — l'in-app reste.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && (process.env.EMAIL_FROM || process.env.RESEND_FROM));
}

export function emailFromAddress(): string | null {
  return process.env.EMAIL_FROM || process.env.RESEND_FROM || null;
}

export async function sendNotificationEmail(input: {
  to: string;
  title: string;
  body: string;
  href?: string | null;
}): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = emailFromAddress();
  if (!apiKey || !from) return { sent: false, skipped: "email_not_configured" };
  if (!input.to.includes("@")) return { sent: false, skipped: "invalid_recipient" };

  const site = (process.env.NEXTAUTH_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "").replace(/\/$/, "");
  const origin = site.startsWith("http") ? site : site ? `https://${site}` : "https://brwm-app.vercel.app";
  const link = input.href ? `${origin}${input.href.startsWith("/") ? input.href : `/${input.href}`}` : `${origin}/notifications`;

  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <p style="color:#C9A227;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-size:12px">OuestBourse</p>
      <h1 style="font-size:20px;margin:8px 0 12px">${escapeHtml(input.title)}</h1>
      <p style="font-size:15px;line-height:1.5">${escapeHtml(input.body)}</p>
      <p><a href="${escapeHtml(link)}" style="color:#1B4D3E;font-weight:700">Ouvrir dans OuestBourse</a></p>
      <p style="font-size:12px;color:#666">Ceci n'est pas un conseil d'investissement. Données de marché BRVM, hors horaires calmes si configurés.</p>
    </div>
  `;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `OuestBourse — ${input.title}`,
        html,
        text: `${input.title}\n\n${input.body}\n\n${link}`,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { sent: false, error: `Resend HTTP ${res.status} ${detail.slice(0, 180)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
