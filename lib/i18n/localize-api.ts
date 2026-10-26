import type { TFunc } from "./create-i18n";

/**
 * Maps stable French API error strings to the active locale.
 * Route handlers keep the French source text so existing clients and
 * tests stay valid; the UI translates at display time.
 */
export function localizeSharedApiMessage(message: string, t: TFunc): string {
  switch (message) {
    case "Authentification requise":
      return t("common.api.sessionRequired");
    case "Connexion requise":
      return t("common.api.authRequired");
    case "Base de données indisponible":
      return t("common.api.dbUnavailable");
    case "Accès administrateur requis":
      return t("common.api.adminRequired");
    case "Indice non suivi":
      return t("common.api.indexNotTracked");
    case "Alerte introuvable":
      return t("common.api.alertMissing");
    case "Règle introuvable":
      return t("common.api.ruleMissing");
    case "Notification introuvable":
      return t("common.api.notificationMissing");
    case "Paramètres invalides":
      return t("common.api.invalidParams");
    case "Corps JSON invalide":
      return t("common.api.invalidJson");
    case "Le compte administrateur n'a pas d'adresse email.":
      return t("common.api.adminNoEmail");
    case "Le test ne peut être envoyé qu'à l'adresse de l'administrateur connecté.":
      return t("common.api.adminEmailOnly");
    case "Un email de test a déjà été tenté il y a moins d'une minute.":
      return t("common.api.adminEmailCooldown");
    case "Le champ to doit être une adresse email":
      return t("common.api.adminToEmail");
    case "Le seuil doit être positif":
      return t("common.api.positiveThreshold");
    default: {
      const ticker = message.match(/^Ticker inconnu : (.+)$/);
      if (ticker?.[1]) return t("common.api.unknownTicker", { ticker: ticker[1] });
      return message;
    }
  }
}
