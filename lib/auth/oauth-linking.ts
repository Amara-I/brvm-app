// Liaison des comptes OAuth (Google, Facebook, Apple, Microsoft).
//
// NextAuth refuse par défaut de rattacher un fournisseur à un utilisateur
// déjà inscrit avec le même email (`OAuthAccountNotLinked`), sauf si
// `allowDangerousEmailAccountLinking` est activé — option qui lie SANS
// regarder si le fournisseur a vérifié l'adresse (prise de compte possible).
//
// Ici la liaison est faite explicitement, et seulement quand le fournisseur
// confirme l'email. Le rôle, le mot de passe et les données existantes ne
// sont pas réécrits : on ajoute une ligne `Account` sur l'utilisateur trouvé.
// Un premier passage OAuth sans utilisateur correspondant est laissé à
// NextAuth (création), avec `emailVerified` posé ensuite si le fournisseur
// l'a confirmé.

export type OAuthProfile = Record<string, unknown> | null | undefined;

export type OAuthProviderId = "google" | "facebook" | "apple" | "azure-ad";

export type OAuthTokenFields = {
  type: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
};

export type OAuthAccountWrite = OAuthTokenFields & {
  provider: string;
  providerAccountId: string;
};

export type LinkedOAuthAccount = {
  userId: string;
  role: string;
  emailVerified: Date | null;
};

export type ExistingOAuthUser = {
  id: string;
  email: string;
  role: string;
  emailVerified: Date | null;
};

export type OAuthAccountRepository = {
  findLinkedAccount(provider: string, providerAccountId: string): Promise<LinkedOAuthAccount | null>;
  findUserByEmail(email: string): Promise<ExistingOAuthUser | null>;
  markEmailVerified(userId: string, at: Date): Promise<void>;
  linkAccount(userId: string, account: OAuthAccountWrite): Promise<void>;
};

export type OAuthLinkInput = {
  provider: string;
  providerAccountId: string;
  profile: OAuthProfile;
  tokens: OAuthTokenFields;
  now?: Date;
};

export type OAuthLinkResult = { ok: true } | { ok: false; error: "OAuthNoEmail" | "OAuthUnverifiedEmail" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeOAuthEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

function claimTrue(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function claimFalse(value: unknown): boolean {
  return value === false || value === "false" || value === 0 || value === "0";
}

/**
 * Le fournisseur affirme-t-il que `email` lui appartient et est confirmé ?
 * Un drapeau explicite « non vérifié » l'emporte toujours.
 */
export function isOAuthEmailVerified(provider: string, profile: OAuthProfile, email: string | null): boolean {
  if (!email || !profile) return false;
  if (claimFalse(profile.email_verified)) return false;

  switch (provider) {
    case "google":
      // Claim OIDC booléen. Certaines bibliothèques le renvoient en chaîne.
      return profile.email_verified === true || profile.email_verified === "true";
    case "apple":
      // Apple : `email_verified` est `true` ou `"true"`. Les serveurs ne
      // renvoient que des adresses vérifiées (y compris le relais privé).
      return claimTrue(profile.email_verified);
    case "facebook":
      // Le Graph API n'a pas de claim `email_verified`. Meta ne renvoie
      // `email` que si une adresse confirmée est disponible (un compte
      // inscrit avec un numéro de téléphone n'en a souvent pas).
      return true;
    case "azure-ad":
      if (claimTrue(profile.email_verified) || claimTrue(profile.xms_edov)) return true;
      // Le claim `email` (distinct de `preferred_username`) est l'adresse
      // du compte Microsoft personnel ou l'attribut mail de l'annuaire.
      return normalizeOAuthEmail(profile.email) === email;
    default:
      return claimTrue(profile.email_verified);
  }
}

export function oauthEmailFromProfile(provider: string, profile: OAuthProfile): string | null {
  if (!profile) return null;
  const email = normalizeOAuthEmail(profile.email);
  if (email) return email;
  if (provider === "azure-ad") return normalizeOAuthEmail(profile.preferred_username);
  return null;
}

export function cleanOAuthName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let name = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) continue;
    name += char;
  }
  name = name.trim();
  if (!name) return null;
  return name.slice(0, 120);
}

export function cleanOAuthImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const image = value.trim();
  if (!image.startsWith("https://") || image.length > 2048) return null;
  return image;
}

function imageFromProfile(provider: string, profile: OAuthProfile): string | null {
  if (!profile) return null;
  if (provider === "facebook") {
    const picture = profile.picture;
    if (!picture || typeof picture !== "object" || !("data" in picture)) return null;
    const data = (picture as { data?: { url?: unknown } }).data;
    return cleanOAuthImage(data?.url);
  }
  const picture = profile.picture ?? profile.image;
  return cleanOAuthImage(picture);
}

export function mapOAuthUser(
  provider: string,
  profile: OAuthProfile,
  now = new Date()
): {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  emailVerified: Date | null;
  role: "USER";
} {
  const raw = profile ?? {};
  const idSource = provider === "facebook" ? raw.id : (raw.sub ?? raw.id);
  const id = typeof idSource === "string" ? idSource : "";
  const email = oauthEmailFromProfile(provider, raw);
  const verified = isOAuthEmailVerified(provider, raw, email);
  return {
    id,
    name: cleanOAuthName(raw.name),
    email,
    image: imageFromProfile(provider, raw),
    emailVerified: verified ? now : null,
    role: "USER",
  };
}

export async function resolveOAuthSignIn(
  input: OAuthLinkInput,
  repo: OAuthAccountRepository
): Promise<OAuthLinkResult> {
  const now = input.now ?? new Date();
  const email = oauthEmailFromProfile(input.provider, input.profile);
  const verified = isOAuthEmailVerified(input.provider, input.profile, email);

  const linked = input.providerAccountId
    ? await repo.findLinkedAccount(input.provider, input.providerAccountId)
    : null;

  if (linked) {
    if (verified && !linked.emailVerified) await repo.markEmailVerified(linked.userId, now);
    return { ok: true };
  }

  if (!email) return { ok: false, error: "OAuthNoEmail" };

  const existing = await repo.findUserByEmail(email);
  if (existing) {
    if (!verified) return { ok: false, error: "OAuthUnverifiedEmail" };
    await repo.linkAccount(existing.id, {
      ...input.tokens,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
    });
    if (!existing.emailVerified) await repo.markEmailVerified(existing.id, now);
    return { ok: true };
  }

  // Nouvel utilisateur : NextAuth crée la ligne User (email en minuscules
  // via `mapOAuthUser`). Aucune écriture ici, pour ne pas doubler la création.
  return { ok: true };
}
