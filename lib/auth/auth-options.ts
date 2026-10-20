// ═══════════════════════════════════════════════════════════════════════════
// Configuration NextAuth.js — email/mot de passe + OAuth
// ═══════════════════════════════════════════════════════════════════════════
// Méthodes de connexion :
//   - Email / mot de passe (`CredentialsProvider`), vérifié contre
//     `User.passwordHash` (bcrypt) — inscription via `POST /api/auth/register`.
//   - OAuth, chaque fournisseur uniquement si ses variables sont définies :
//     Google, Facebook, Apple, Microsoft (Azure AD). Voir
//     `docs/oauth-providers.md`.
//
// Liaison : un compte email/mot de passe existant est rattaché au fournisseur
// seulement si celui-ci confirme l'adresse (pas de
// `allowDangerousEmailAccountLinking`). Le rôle, le mot de passe et les
// données liées (portefeuille, alertes) restent ceux de l'utilisateur trouvé.
// Un email absent (cas fréquent Facebook) refuse la connexion avec un message
// français. Les admins restent `User.role = ADMIN` ou `ADMIN_EMAILS`.
//
// Confirmation d'email : souple (soft gate) pour les comptes mot de passe.
// Un fournisseur qui confirme l'adresse pose `emailVerified`.
//
// Stratégie de session : JWT (obligatoire avec Credentials dans NextAuth v4).
// `PrismaAdapter` persiste les comptes OAuth (table `accounts`, déjà migrée).
// ═══════════════════════════════════════════════════════════════════════════

import type { Account, AuthOptions, Profile } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "./admin-emails";
import { resolveAuthRedirectUrl } from "./app-url";
import { createOAuthAccountRepository, isUniqueConstraintError } from "./oauth-account-repository";
import { createOAuthProviders } from "./oauth-providers";
import { resolveOAuthSignIn, type OAuthTokenFields } from "./oauth-linking";
import { verifyPassword } from "./password";
import { loginCredentialsSchema } from "./schemas";

const oauthAccounts = createOAuthAccountRepository(prisma);
const oauthProviders = createOAuthProviders(process.env);

/** Identifiants réellement enregistrés (clé Apple illisible = bouton masqué). */
export const enabledOAuthProviderIds: string[] = oauthProviders.map((provider) => provider.id);

const providers: AuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email et mot de passe",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Mot de passe", type: "password" },
    },
    async authorize(credentials) {
      const parsed = loginCredentialsSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
      });
      // `passwordHash` null = compte créé uniquement via OAuth →
      // pas de mot de passe à vérifier, connexion par Credentials refusée.
      if (!user || !user.passwordHash) return null;

      const isValid = await verifyPassword(parsed.data.password, user.passwordHash);
      if (!isValid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      };
    },
  }),
  ...oauthProviders,
];

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function tokenFields(account: Account): OAuthTokenFields {
  return {
    type: account.type,
    refresh_token: asString(account.refresh_token),
    access_token: asString(account.access_token),
    expires_at: typeof account.expires_at === "number" && Number.isFinite(account.expires_at) ? account.expires_at : null,
    token_type: asString(account.token_type),
    scope: asString(account.scope),
    id_token: asString(account.id_token),
    session_state: asString(account.session_state),
  };
}

const OAUTH_SIGN_IN_ERRORS = new Set(["OAuthNoEmail", "OAuthUnverifiedEmail", "Callback"]);

function emailVerifiedStamp(profile: Profile | undefined): Date | null {
  if (!profile || typeof profile !== "object") return null;
  const value = (profile as { emailVerified?: unknown }).emailVerified;
  return value instanceof Date ? value : null;
}

function rethrowOAuthSignIn(error: unknown): never {
  if (error instanceof Error && OAUTH_SIGN_IN_ERRORS.has(error.message)) throw error;
  console.error("[auth] liaison OAuth impossible", error instanceof Error ? error.name : "unknown");
  throw new Error("Callback");
}

async function signInWithOAuth(account: Account, profile: Profile | undefined): Promise<true> {
  if (!account.providerAccountId) throw new Error("Callback");
  const result = await resolveOAuthSignIn(
    {
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      profile: (profile ?? null) as Record<string, unknown> | null,
      tokens: tokenFields(account),
    },
    oauthAccounts
  );
  if (!result.ok) throw new Error(result.error);
  return true;
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/connexion",
    signOut: "/deconnexion",
    error: "/connexion",
  },
  providers,
  events: {
    async signIn({ user, account, profile }) {
      if (!user.id || !account || account.provider === "credentials") return;
      const stamp = emailVerifiedStamp(profile);
      if (!stamp) return;
      try {
        await prisma.user.updateMany({
          where: { id: user.id, emailVerified: null },
          data: { emailVerified: stamp },
        });
      } catch (error) {
        console.error(
          "[auth] impossible de marquer emailVerified après OAuth",
          error instanceof Error ? error.name : "unknown"
        );
      }
    },
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (!account || account.provider === "credentials") return true;
      try {
        return await signInWithOAuth(account, profile);
      } catch (error) {
        // Deux callbacks parallèles peuvent entrer en collision sur
        // l'unicité (provider, providerAccountId) ou l'email : on relit.
        if (!isUniqueConstraintError(error)) rethrowOAuthSignIn(error);
        try {
          return await signInWithOAuth(account, profile);
        } catch (retryError) {
          rethrowOAuthSignIn(retryError);
        }
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "USER";
        token.emailVerified = Boolean(user.emailVerified);
      }

      // Rafraîchir depuis la base : à la connexion (rôle ADMIN Prisma) et tant
      // que l'email n'est pas confirmé (soft gate → bandeau disparaît sans re-login).
      if (token.id && (user || token.emailVerified !== true)) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: String(token.id) },
            select: { emailVerified: true, role: true },
          });
          if (fresh) {
            token.emailVerified = Boolean(fresh.emailVerified);
            token.role = fresh.role;
          }
        } catch {
          // Base injoignable : on conserve le JWT tel quel.
        }
      }

      if (token.email && isAdminEmail(String(token.email))) {
        token.role = "ADMIN";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role ?? "USER";
        session.user.emailVerified = token.emailVerified === true;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // NEXTAUTH_URL cassé (`https`, `NEXTAUTH_URL=https://…`) ne doit jamais
      // devenir le Location de déconnexion (host littéral `nextauth_url=https`).
      return resolveAuthRedirectUrl(url, baseUrl);
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
