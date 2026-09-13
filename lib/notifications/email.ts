// E-mails d'alerte via la même stack que l'auth (Resend ou SMTP).
// Si aucun fournisseur n'est configuré, on ignore — l'in-app reste.

import { getAppBaseUrl } from "@/lib/auth/app-url";
import { isEmailConfigured as authEmailConfigured, sendAppEmail } from "@/lib/auth/email";
import { BRAND_NAME } from "@/lib/theme/brand";

export function isEmailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return authEmailConfigured(env);
}

export async function sendNotificationEmail(input: {
  to: string;
  title: string;
  body: string;
  href?: string | null;
}): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  if (!isEmailConfigured()) return { sent: false, skipped: "email_not_configured" };
  if (!input.to.includes("@")) return { sent: false, skipped: "invalid_recipient" };

  const origin = getAppBaseUrl();
  const path = input.href
    ? input.href.startsWith("/")
      ? input.href
      : `/${input.href}`
    : "/notifications";
  const link = `${origin}${path}`;

  const result = await sendAppEmail({
    to: input.to,
    subject: `${BRAND_NAME} — ${input.title}`,
    text: `${input.title}\n\n${input.body}\n\n${link}`,
    html: `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <p style="color:#C9A227;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-size:12px">${escapeHtml(BRAND_NAME)}</p>
      <h1 style="font-size:20px;margin:8px 0 12px">${escapeHtml(input.title)}</h1>
      <p style="font-size:15px;line-height:1.5">${escapeHtml(input.body)}</p>
      <p><a href="${escapeHtml(link)}" style="color:#1B4D3E;font-weight:700">Ouvrir dans ${escapeHtml(BRAND_NAME)}</a></p>
      <p style="font-size:12px;color:#666">Ceci n'est pas un conseil d'investissement. Données de marché BRVM, hors horaires calmes si configurés.</p>
    </div>
  `,
  });

  if (!result.ok) {
    if (result.code === "not_configured" || result.code === "invalid_from") {
      return { sent: false, skipped: "email_not_configured" };
    }
    return { sent: false, error: result.error };
  }
  return { sent: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
