import { BRAND_NAME } from "@/lib/theme/brand";
import { buildAuthLink, getAppBaseUrl } from "./app-url";

export type AuthEmailKind = "verify" | "reset";

export type SendEmailResult =
  | { ok: true; provider: "resend" | "smtp" | "log" }
  | { ok: false; error: string };

type EnvMap = Record<string, string | undefined>;

export function isEmailConfigured(env: EnvMap = process.env): boolean {
  if (env.RESEND_API_KEY?.trim()) return true;
  if (env.EMAIL_SERVER?.trim()) return true;
  if (env.EMAIL_SERVER_HOST?.trim()) return true;
  return false;
}

export function getEmailFrom(env: EnvMap = process.env): string {
  return env.EMAIL_FROM?.trim() || `${BRAND_NAME} <noreply@localhost>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAuthEmail(kind: AuthEmailKind, to: string, rawToken: string): {
  subject: string;
  text: string;
  html: string;
} {
  const link =
    kind === "verify"
      ? buildAuthLink("/verifier-email", rawToken)
      : buildAuthLink("/reinitialiser-mot-de-passe", rawToken);
  const hours = kind === "verify" ? 24 : 1;
  const subject =
    kind === "verify"
      ? `Confirmez votre adresse email — ${BRAND_NAME}`
      : `Réinitialisation de mot de passe — ${BRAND_NAME}`;
  const intro =
    kind === "verify"
      ? `Bienvenue sur ${BRAND_NAME}. Confirmez votre adresse email (${to}) en ouvrant le lien ci-dessous.`
      : `Une demande de réinitialisation de mot de passe a été faite pour le compte ${to}.`;
  const cta = kind === "verify" ? "Confirmer mon email" : "Choisir un nouveau mot de passe";
  const expiry = `Ce lien expire dans ${hours} heure${hours > 1 ? "s" : ""} et ne peut être utilisé qu'une seule fois.`;
  const ignore =
    kind === "verify"
      ? "Si vous n'avez pas créé de compte, ignorez simplement cet email."
      : "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.";

  const text = [`Bonjour,`, ``, intro, ``, `${cta} : ${link}`, ``, expiry, ignore].join("\n");
  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="font-family:Georgia,serif;background:#0f1410;color:#f4f1ea;padding:24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#1a211c;border:1px solid #3d4c43;border-radius:12px;padding:24px;">
    <tr><td>
      <p style="margin:0 0 8px;color:#c9962e;font-weight:700;letter-spacing:0.04em;">${escapeHtml(BRAND_NAME)}</p>
      <h1 style="margin:0 0 16px;font-size:1.25rem;color:#f4f1ea;">${escapeHtml(cta)}</h1>
      <p style="margin:0 0 16px;line-height:1.5;color:#d5dcd2;">${escapeHtml(intro)}</p>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#c9962e;color:#1a1206;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;">${escapeHtml(cta)}</a>
      </p>
      <p style="margin:0 0 8px;font-size:0.85rem;color:#9aa89e;">${escapeHtml(expiry)}</p>
      <p style="margin:0;font-size:0.85rem;color:#9aa89e;">${escapeHtml(ignore)}</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

async function sendViaResend(to: string, subject: string, html: string, text: string): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY manquant" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `Resend HTTP ${res.status}${detail ? `: ${detail.slice(0, 240)}` : ""}` };
  }
  return { ok: true, provider: "resend" };
}

async function sendViaSmtp(to: string, subject: string, html: string, text: string): Promise<SendEmailResult> {
  const nodemailer = await import("nodemailer");
  const serverUrl = process.env.EMAIL_SERVER?.trim();
  const transporter = serverUrl
    ? nodemailer.createTransport(serverUrl)
    : nodemailer.createTransport({
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT || 587),
        secure: process.env.EMAIL_SERVER_SECURE === "true",
        auth:
          process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD
            ? {
                user: process.env.EMAIL_SERVER_USER,
                pass: process.env.EMAIL_SERVER_PASSWORD,
              }
            : undefined,
      });

  await transporter.sendMail({
    from: getEmailFrom(),
    to,
    subject,
    text,
    html,
  });
  return { ok: true, provider: "smtp" };
}

export async function sendAuthEmail(kind: AuthEmailKind, to: string, rawToken: string): Promise<SendEmailResult> {
  const { subject, text, html } = buildAuthEmail(kind, to, rawToken);
  const link =
    kind === "verify"
      ? buildAuthLink("/verifier-email", rawToken)
      : buildAuthLink("/reinitialiser-mot-de-passe", rawToken);

  if (process.env.RESEND_API_KEY?.trim()) {
    return sendViaResend(to, subject, html, text);
  }
  if (process.env.EMAIL_SERVER?.trim() || process.env.EMAIL_SERVER_HOST?.trim()) {
    return sendViaSmtp(to, subject, html, text);
  }

  console.info(`[auth:email] ${kind} pour ${to} (aucun fournisseur configuré) — ${link}`);
  return { ok: true, provider: "log" };
}

export function isDevAuthPreviewEnabled(env: EnvMap = process.env): boolean {
  return env.NODE_ENV !== "production";
}

export function describeAppMailSetup(): { configured: boolean; baseUrl: string } {
  return { configured: isEmailConfigured(), baseUrl: getAppBaseUrl() };
}
