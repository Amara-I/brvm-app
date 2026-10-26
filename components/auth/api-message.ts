import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import type { TFunc } from "@/lib/i18n/create-i18n";

export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Zod et le wrapper « Paramètres invalides » restent en français côté API. */
export function localizeAuthApiMessage(message: string, t: TFunc): string {
  if (message === "Adresse email invalide") return t("auth.invalidEmail");
  if (message === "Mot de passe requis") return t("auth.passwordRequired");
  if (message === "Lien de réinitialisation invalide") return t("auth.invalidResetLink");
  if (message === "Aucun champ à mettre à jour") return t("auth.nothingToUpdate");
  if (message === "Paramètres invalides") return t("auth.invalidParams");
  if (message === `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`) {
    return t("auth.passwordMin", { count: MIN_PASSWORD_LENGTH });
  }
  if (message === "Les deux mots de passe ne correspondent pas.") return t("auth.passwordMismatch");
  return message;
}

export function messageFromAuthJson(json: unknown, t: TFunc, fallback: string): string {
  const record =
    json && typeof json === "object"
      ? (json as { error?: unknown; details?: { fieldErrors?: Record<string, unknown> } })
      : null;
  const fieldErrors = record?.details?.fieldErrors;
  let fieldMessage: string | undefined;
  if (fieldErrors && typeof fieldErrors === "object") {
    for (const value of Object.values(fieldErrors)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        fieldMessage = value[0];
        break;
      }
    }
  }
  const raw = fieldMessage ?? (typeof record?.error === "string" ? record.error : fallback);
  return localizeAuthApiMessage(raw, t);
}

export function oauthMessage(code: string | null | undefined, t: TFunc): string {
  switch (code) {
    case "CredentialsSignin":
      return t("auth.oauth.credentials");
    case "OAuthAccountNotLinked":
      return t("auth.oauth.notLinked");
    case "OAuthNoEmail":
      return t("auth.oauth.noEmail");
    case "OAuthUnverifiedEmail":
      return t("auth.oauth.unverifiedEmail");
    case "OAuthSignin":
      return t("auth.oauth.signin");
    case "OAuthCallback":
      return t("auth.oauth.callback");
    case "OAuthCreateAccount":
      return t("auth.oauth.createAccount");
    case "Callback":
      return t("auth.oauth.callbackRoute");
    case "AccessDenied":
      return t("auth.oauth.accessDenied");
    case "Configuration":
      return t("auth.oauth.configuration");
    default:
      return t("auth.oauth.default");
  }
}
