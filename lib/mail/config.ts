// Sélection du transport d'email (SMTP générique ou Resend).
// Pur : aucune I/O. Les envois passent par `lib/auth/email.ts`.
//
// Priorité si EMAIL_PROVIDER est absent :
//   1. SMTP dès que la config SMTP est utilisable (SMTP_* ou alias historiques)
//   2. sinon Resend si RESEND_API_KEY est défini
// EMAIL_PROVIDER=smtp|resend force le choix et n'a pas de repli silencieux :
// une config incomplète pour le fournisseur demandé = pas de fournisseur.

import { parseAdminEmails } from "../auth/admin-emails";

export type EnvMap = Record<string, string | undefined>;

export type MailProviderId = "smtp" | "resend";

export type SmtpAuth = { user: string; pass: string };

export type SmtpTransportConfig =
  | { source: "url"; url: string }
  | { source: "options"; host: string; port: number; secure: boolean; auth?: SmtpAuth };

const TRUTHY = new Set(["true", "1", "yes"]);
const FALSY = new Set(["false", "0", "no"]);

function present(env: EnvMap, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function gmailHostname(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "smtp.gmail.com" || normalized === "smtp.googlemail.com";
}

export function smtpAuthUser(config: SmtpTransportConfig): string | null {
  if (config.source === "options") return config.auth?.user ?? null;
  try {
    const username = new URL(config.url).username;
    return username ? decodeURIComponent(username) : null;
  } catch {
    return null;
  }
}

export function isGmailSmtp(config: SmtpTransportConfig): boolean {
  if (config.source === "options") return gmailHostname(config.host);
  try {
    return gmailHostname(new URL(config.url).hostname);
  } catch {
    return /smtp\.gmail\.com|smtp\.googlemail\.com/i.test(config.url);
  }
}

/// Gmail n'accepte comme expéditeur que le compte (ou un alias « Envoyer
/// en tant que »). Un From différent est réécrit. On ne bloque pas l'envoi
/// (un alias configuré dans Gmail est légitime) : l'appelant journalise.
export function gmailFromMismatch(config: SmtpTransportConfig, fromAddress: string): boolean {
  if (!isGmailSmtp(config)) return false;
  const user = smtpAuthUser(config);
  if (!user) return false;
  return user.trim().toLowerCase() !== fromAddress.trim().toLowerCase();
}

function modernSmtpTouched(env: EnvMap): boolean {
  return Boolean(
    present(env, "SMTP_HOST") ||
      present(env, "SMTP_PORT") ||
      present(env, "SMTP_SECURE") ||
      present(env, "SMTP_USER") ||
      present(env, "SMTP_PASS")
  );
}

function anySmtpTouched(env: EnvMap): boolean {
  return (
    modernSmtpTouched(env) ||
    Boolean(
      present(env, "EMAIL_SERVER") ||
        present(env, "EMAIL_SERVER_HOST") ||
        present(env, "EMAIL_SERVER_PORT") ||
        present(env, "EMAIL_SERVER_USER") ||
        present(env, "EMAIL_SERVER_PASSWORD") ||
        present(env, "EMAIL_SERVER_SECURE")
    )
  );
}

/// Config SMTP utilisable, ou null si absente / incomplète / invalide.
/// SMTP_* prime sur l'URL historique EMAIL_SERVER.
/// Un hôte sans authentification reste accepté (relais local).
/// Un identifiant sans mot de passe (ou l'inverse) est incomplet → null.
export function resolveSmtpConfig(env: EnvMap = process.env): SmtpTransportConfig | null {
  const host = present(env, "SMTP_HOST");
  const legacyUrl = present(env, "EMAIL_SERVER");

  if (!modernSmtpTouched(env) && legacyUrl && !present(env, "EMAIL_SERVER_HOST")) {
    return { source: "url", url: legacyUrl };
  }

  const resolvedHost = host ?? present(env, "EMAIL_SERVER_HOST");
  if (!resolvedHost) return null;

  const portRaw = present(env, "SMTP_PORT") ?? present(env, "EMAIL_SERVER_PORT");
  let port = 587;
  if (portRaw) {
    const parsed = Number(portRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return null;
    port = parsed;
  }

  const secureRaw = (present(env, "SMTP_SECURE") ?? present(env, "EMAIL_SERVER_SECURE"))?.toLowerCase();
  let secure: boolean;
  if (!secureRaw) secure = port === 465;
  else if (TRUTHY.has(secureRaw)) secure = true;
  else if (FALSY.has(secureRaw)) secure = false;
  else return null;

  const user = present(env, "SMTP_USER") ?? present(env, "EMAIL_SERVER_USER");
  const pass = present(env, "SMTP_PASS") ?? present(env, "EMAIL_SERVER_PASSWORD");
  const authTouched = Boolean(
    present(env, "SMTP_USER") ||
      present(env, "SMTP_PASS") ||
      present(env, "EMAIL_SERVER_USER") ||
      present(env, "EMAIL_SERVER_PASSWORD")
  );
  if (authTouched && (!user || !pass)) return null;

  return {
    source: "options",
    host: resolvedHost,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
  };
}

export function resolveEmailProvider(env: EnvMap = process.env): MailProviderId | null {
  const explicit = present(env, "EMAIL_PROVIDER")?.toLowerCase();
  if (explicit) {
    if (explicit === "smtp") return resolveSmtpConfig(env) ? "smtp" : null;
    if (explicit === "resend") return present(env, "RESEND_API_KEY") ? "resend" : null;
    return null;
  }
  if (resolveSmtpConfig(env)) return "smtp";
  // SMTP_* entamé mais inutilisable : pas de repli silencieux sur Resend.
  if (anySmtpTouched(env)) return null;
  if (present(env, "RESEND_API_KEY")) return "resend";
  return null;
}

export type RecipientDecision =
  | { ok: true; to: string }
  | { ok: false; reason: "missing_admin_email" | "recipient_not_allowed" | "no_default_recipient" };

/// Essai admin : uniquement l'adresse de la session. Pas de relais ouvert.
export function resolveAdminTestRecipient(
  adminEmail: string | null | undefined,
  requested: string | undefined
): RecipientDecision {
  const admin = adminEmail?.trim().toLowerCase();
  if (!admin || !admin.includes("@")) return { ok: false, reason: "missing_admin_email" };
  if (requested === undefined || requested.trim() === "") return { ok: true, to: admin };
  if (requested.trim().toLowerCase() !== admin) return { ok: false, reason: "recipient_not_allowed" };
  return { ok: true, to: admin };
}

/// Script local : SMTP_USER, l'utilisateur d'une URL SMTP, ou ADMIN_EMAILS.
export function resolveCliTestRecipient(env: EnvMap, requested?: string): RecipientDecision {
  const allowed = new Set<string>();
  const config = resolveSmtpConfig(env);
  const fromConfig = config ? smtpAuthUser(config) : null;
  const smtpUser = (fromConfig ?? present(env, "SMTP_USER") ?? present(env, "EMAIL_SERVER_USER"))?.toLowerCase();
  if (smtpUser?.includes("@")) allowed.add(smtpUser);
  for (const email of parseAdminEmails(env.ADMIN_EMAILS)) allowed.add(email);

  const raw = requested?.trim();
  if (!raw) {
    const fallback = smtpUser?.includes("@") ? smtpUser : parseAdminEmails(env.ADMIN_EMAILS)[0];
    if (!fallback) return { ok: false, reason: "no_default_recipient" };
    return { ok: true, to: fallback };
  }
  const normalized = raw.toLowerCase();
  if (!allowed.has(normalized)) return { ok: false, reason: "recipient_not_allowed" };
  return { ok: true, to: normalized };
}
