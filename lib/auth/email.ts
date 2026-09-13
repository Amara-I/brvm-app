import { BRAND_NAME } from "@/lib/theme/brand";
import { buildAuthLink, getAppBaseUrl } from "./app-url";

export type AuthEmailKind = "verify" | "reset";

export type MailFailureCode = "not_configured" | "invalid_from" | "send_failed";

export type SendEmailResult =
  | { ok: true; provider: "resend" | "smtp" }
  | { ok: false; code: MailFailureCode; error: string; userMessage: string };

type EnvMap = Record<string, string | undefined>;

export const MAIL_USER_MESSAGES = {
  not_configured:
    "L'envoi d'emails n'est pas configuré. Sur Vercel, renseignez RESEND_API_KEY (ou SMTP) et EMAIL_FROM avec un domaine vérifié.",
  invalid_from:
    "EMAIL_FROM est invalide. Utilisez une adresse d'un domaine vérifié chez Resend, par exemple OuestBourse <noreply@votre-domaine.com>.",
  send_failed:
    "L'envoi de l'email a échoué. Vérifiez RESEND_API_KEY, EMAIL_FROM et que le domaine est bien vérifié, puis réessayez.",
} as const;

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function hasEmailProvider(env: EnvMap = process.env): boolean {
  if (env.RESEND_API_KEY?.trim()) return true;
  if (env.EMAIL_SERVER?.trim()) return true;
  if (env.EMAIL_SERVER_HOST?.trim()) return true;
  return false;
}

export function parseEmailFrom(raw: string | undefined): { value: string; address: string } | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const angled = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  const address = (angled ? angled[2] : trimmed).trim().toLowerCase();
  if (!EMAIL_RE.test(address)) return null;
  const domain = address.split("@")[1] ?? "";
  if (domain === "localhost" || domain.endsWith(".local") || domain === "example.com") return null;
  return { value: trimmed, address };
}

export function getEmailFrom(env: EnvMap = process.env): string | null {
  return parseEmailFrom(env.EMAIL_FROM)?.value ?? null;
}

export function isEmailConfigured(env: EnvMap = process.env): boolean {
  return hasEmailProvider(env) && Boolean(parseEmailFrom(env.EMAIL_FROM));
}

export function userMessageForMailFailure(result: Extract<SendEmailResult, { ok: false }>): string {
  return result.userMessage || MAIL_USER_MESSAGES[result.code];
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

function fail(code: MailFailureCode, error: string): SendEmailResult {
  return { ok: false, code, error, userMessage: MAIL_USER_MESSAGES[code] };
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
  from: string
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return fail("not_configured", "RESEND_API_KEY manquant");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    const raw = await res.text().catch(() => "");
    let parsed: { message?: string; name?: string; id?: string } | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as { message?: string; name?: string; id?: string }) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const detail = parsed?.message || raw.slice(0, 240) || `HTTP ${res.status}`;
      console.error("[auth:email] Resend a refusé l'envoi", {
        status: res.status,
        name: parsed?.name,
        message: parsed?.message,
      });
      return fail("send_failed", `Resend HTTP ${res.status}: ${detail}`);
    }
    console.info("[auth:email] envoyé via Resend", { to, id: parsed?.id ?? null });
    return { ok: true, provider: "resend" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[auth:email] Resend injoignable", message);
    return fail("send_failed", message);
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaSmtp(
  to: string,
  subject: string,
  html: string,
  text: string,
  from: string
): Promise<SendEmailResult> {
  try {
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

    const info = await transporter.sendMail({ from, to, subject, text, html });
    console.info("[auth:email] envoyé via SMTP", { to, messageId: info.messageId ?? null });
    return { ok: true, provider: "smtp" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[auth:email] SMTP a échoué", message);
    return fail("send_failed", message);
  }
}

export async function sendAppEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const from = getEmailFrom();
  if (!hasEmailProvider()) {
    return fail("not_configured", "Aucun fournisseur email");
  }
  if (!from) {
    return fail("invalid_from", "EMAIL_FROM manquant ou invalide");
  }
  if (process.env.RESEND_API_KEY?.trim()) {
    return sendViaResend(input.to, input.subject, input.html, input.text, from);
  }
  return sendViaSmtp(input.to, input.subject, input.html, input.text, from);
}

export async function sendAuthEmail(kind: AuthEmailKind, to: string, rawToken: string): Promise<SendEmailResult> {
  const { subject, text, html } = buildAuthEmail(kind, to, rawToken);
  const from = getEmailFrom();

  if (!hasEmailProvider()) {
    console.error("[auth:email] aucun fournisseur (RESEND_API_KEY / EMAIL_SERVER) — envoi refusé", {
      kind,
      to,
      baseUrl: getAppBaseUrl(),
    });
    return fail("not_configured", "Aucun fournisseur email");
  }
  if (!from) {
    console.error("[auth:email] EMAIL_FROM manquant ou invalide — envoi refusé", {
      kind,
      raw: process.env.EMAIL_FROM ?? null,
    });
    return fail("invalid_from", "EMAIL_FROM manquant ou invalide");
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    return sendViaResend(to, subject, html, text, from);
  }
  return sendViaSmtp(to, subject, html, text, from);
}

export function isDevAuthPreviewEnabled(env: EnvMap = process.env): boolean {
  return env.NODE_ENV !== "production";
}

export function describeAppMailSetup(env: EnvMap = process.env): {
  configured: boolean;
  hasProvider: boolean;
  hasValidFrom: boolean;
  baseUrl: string;
} {
  return {
    configured: isEmailConfigured(env),
    hasProvider: hasEmailProvider(env),
    hasValidFrom: Boolean(parseEmailFrom(env.EMAIL_FROM)),
    baseUrl: getAppBaseUrl(env),
  };
}
