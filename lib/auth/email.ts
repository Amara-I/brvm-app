// Import relatif (pas `@/`) : ce module est aussi chargé par `ts-node`
// (`scripts/send-test-email.ts`), qui ne résout pas l'alias `@/*`.
import { BRAND_NAME } from "../theme/brand";
import {
  gmailFromMismatch,
  resolveEmailProvider,
  resolveSmtpConfig,
  type EnvMap,
  type MailProviderId,
} from "../mail/config";
import { buildAuthLink, getAppBaseUrl } from "./app-url";

export type AuthEmailKind = "verify" | "reset";

export type MailFailureCode = "not_configured" | "invalid_from" | "send_failed";

export type SendEmailResult =
  | { ok: true; provider: MailProviderId }
  | { ok: false; code: MailFailureCode; error: string; userMessage: string };

export const MAIL_USER_MESSAGES = {
  not_configured:
    "L'envoi d'emails n'est pas configuré. Sur Vercel, renseignez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS et EMAIL_FROM (Gmail : mot de passe d'application), ou EMAIL_PROVIDER=resend avec RESEND_API_KEY.",
  invalid_from:
    "EMAIL_FROM est invalide. Pour Gmail, utilisez l'adresse du compte (ou un alias « Envoyer en tant que »), par exemple OuestBourse <vous@gmail.com>.",
  send_failed:
    "L'envoi de l'email a échoué. Vérifiez le mot de passe d'application, SMTP_HOST, SMTP_PORT, SMTP_SECURE et EMAIL_FROM, puis réessayez.",
} as const;

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function hasEmailProvider(env: EnvMap = process.env): boolean {
  return resolveEmailProvider(env) !== null;
}

export function resolveReplyTo(env: EnvMap = process.env): { ok: true; value: string | null } | { ok: false } {
  const raw = env.EMAIL_REPLY_TO?.trim();
  if (!raw) return { ok: true, value: null };
  const parsed = parseEmailFrom(raw);
  if (!parsed) return { ok: false };
  return { ok: true, value: parsed.address };
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

function fail(code: MailFailureCode, error: string, userMessage?: string): SendEmailResult {
  return { ok: false, code, error, userMessage: userMessage ?? MAIL_USER_MESSAGES[code] };
}

function redactSecrets(message: string, env: EnvMap): string {
  let out = message;
  for (const key of ["SMTP_PASS", "EMAIL_SERVER_PASSWORD", "RESEND_API_KEY", "EMAIL_SERVER"] as const) {
    const secret = env[key]?.trim();
    if (secret && secret.length >= 4) out = out.split(secret).join("***");
  }
  return out;
}

type OutboundMail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from: string;
  replyTo: string | null;
};

async function sendViaResend(mail: OutboundMail, env: EnvMap): Promise<SendEmailResult> {
  const apiKey = env.RESEND_API_KEY?.trim();
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
      body: JSON.stringify({
        from: mail.from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
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
    console.info("[auth:email] envoyé via Resend", { to: mail.to, id: parsed?.id ?? null });
    return { ok: true, provider: "resend" };
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error), env);
    console.error("[auth:email] Resend injoignable", message);
    return fail("send_failed", message);
  } finally {
    clearTimeout(timer);
  }
}

type MailTransport = {
  sendMail: (message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
  }) => Promise<{ messageId?: string }>;
};

type NodemailerModule = {
  createTransport?: (options: unknown) => MailTransport;
  default?: { createTransport?: (options: unknown) => MailTransport };
};

async function sendViaSmtp(mail: OutboundMail, env: EnvMap): Promise<SendEmailResult> {
  const config = resolveSmtpConfig(env);
  if (!config) return fail("not_configured", "Configuration SMTP incomplète");

  const fromAddress = parseEmailFrom(mail.from)?.address;
  if (fromAddress && gmailFromMismatch(config, fromAddress)) {
    console.warn(
      "[auth:email] Gmail réécrit l'expéditeur : EMAIL_FROM doit être le compte SMTP_USER (ou un alias autorisé)",
      { from: fromAddress }
    );
  }

  try {
    const nodemailer = (await import("nodemailer")) as NodemailerModule;
    const createTransport = nodemailer.createTransport ?? nodemailer.default?.createTransport;
    if (!createTransport) return fail("send_failed", "nodemailer.createTransport introuvable");

    const transporter =
      config.source === "url"
        ? createTransport(config.url)
        : createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: config.auth,
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
          });

    const info = await transporter.sendMail({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    });
    console.info("[auth:email] envoyé via SMTP", { to: mail.to, messageId: info.messageId ?? null });
    return { ok: true, provider: "smtp" };
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error), env);
    console.error("[auth:email] SMTP a échoué", message);
    return fail("send_failed", message);
  }
}

async function dispatchMail(
  input: { to: string; subject: string; html: string; text: string },
  logContext: string
): Promise<SendEmailResult> {
  const env = process.env;
  const provider = resolveEmailProvider(env);
  const from = getEmailFrom(env);

  if (!provider) {
    console.error(`[auth:email] aucun fournisseur — envoi refusé (${logContext})`, {
      to: input.to,
      baseUrl: getAppBaseUrl(env),
    });
    return fail("not_configured", "Aucun fournisseur email");
  }
  if (!from) {
    console.error("[auth:email] EMAIL_FROM manquant ou invalide — envoi refusé", {
      context: logContext,
      raw: env.EMAIL_FROM ?? null,
    });
    return fail("invalid_from", "EMAIL_FROM manquant ou invalide");
  }

  const replyTo = resolveReplyTo(env);
  if (!replyTo.ok) {
    console.error("[auth:email] EMAIL_REPLY_TO invalide — envoi refusé", { raw: env.EMAIL_REPLY_TO ?? null });
    return fail(
      "invalid_from",
      "EMAIL_REPLY_TO invalide",
      "EMAIL_REPLY_TO est invalide. Laissez-le vide ou indiquez une adresse réelle."
    );
  }

  const mail: OutboundMail = { ...input, from, replyTo: replyTo.value };
  if (provider === "resend") return sendViaResend(mail, env);
  return sendViaSmtp(mail, env);
}

export async function sendAppEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  return dispatchMail(input, "app");
}

export async function sendAuthEmail(kind: AuthEmailKind, to: string, rawToken: string): Promise<SendEmailResult> {
  const { subject, text, html } = buildAuthEmail(kind, to, rawToken);
  return dispatchMail({ to, subject, text, html }, kind);
}

export function isDevAuthPreviewEnabled(env: EnvMap = process.env): boolean {
  return env.NODE_ENV !== "production";
}

export function describeAppMailSetup(env: EnvMap = process.env): {
  configured: boolean;
  hasProvider: boolean;
  hasValidFrom: boolean;
  provider: MailProviderId | null;
  baseUrl: string;
} {
  return {
    configured: isEmailConfigured(env),
    hasProvider: hasEmailProvider(env),
    hasValidFrom: Boolean(parseEmailFrom(env.EMAIL_FROM)),
    provider: resolveEmailProvider(env),
    baseUrl: getAppBaseUrl(env),
  };
}
