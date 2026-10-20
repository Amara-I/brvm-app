// Messages français affichés sur /connexion pour les erreurs NextAuth
// et les refus de liaison OAuth. Module sans dépendance Node : importable
// par les composants client.

export const AUTH_ERROR_MESSAGES = {
  CredentialsSignin: "Email ou mot de passe incorrect.",
  OAuthAccountNotLinked:
    "Un compte existe déjà avec cette adresse email. Connectez-vous avec votre mot de passe. La liaison automatique n'a lieu que si le fournisseur confirme l'adresse.",
  OAuthNoEmail:
    "Ce compte ne fournit pas d'adresse email. Avec Facebook, ajoutez une adresse email confirmée au compte, puis réessayez — ou inscrivez-vous avec votre email.",
  OAuthUnverifiedEmail:
    "Ce fournisseur n'a pas confirmé votre adresse email. Pour protéger votre compte, la liaison est refusée. Connectez-vous avec votre email et votre mot de passe.",
  OAuthSignin: "Impossible de démarrer la connexion. Réessayez.",
  OAuthCallback: "La connexion a échoué. Réessayez.",
  OAuthCreateAccount: "Impossible de créer le compte. Réessayez.",
  Callback: "La connexion a échoué. Réessayez.",
  AccessDenied: "Connexion refusée.",
  Configuration: "La connexion est temporairement indisponible.",
  Default: "La connexion a échoué. Réessayez.",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES;

export const OAUTH_SIGN_IN_BUTTONS = [
  { id: "google", label: "Continuer avec Google" },
  { id: "facebook", label: "Continuer avec Facebook" },
  { id: "apple", label: "Continuer avec Apple" },
  { id: "azure-ad", label: "Continuer avec Microsoft" },
] as const;

export type OAuthButtonId = (typeof OAUTH_SIGN_IN_BUTTONS)[number]["id"];

export function authErrorMessage(code: string | null | undefined): string {
  if (!code) return AUTH_ERROR_MESSAGES.Default;
  if (Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, code)) {
    return AUTH_ERROR_MESSAGES[code as AuthErrorCode];
  }
  return AUTH_ERROR_MESSAGES.Default;
}
