// Fournisseurs OAuth enregistrés seulement si leurs variables d'environnement
// sont présentes. Aucun bouton ni aucune route de callback n'est exposé tant
// que les identifiants manquent : la prod email/mot de passe continue de
// fonctionner avant la configuration Google / Facebook / Apple / Microsoft.
//
// La liaison à un compte existant n'utilise PAS
// `allowDangerousEmailAccountLinking` : elle est décidée dans
// `resolveOAuthSignIn` (email confirmé par le fournisseur uniquement).

import type { Provider } from "next-auth/providers/index";
import AppleProvider from "next-auth/providers/apple";
import AzureADProvider from "next-auth/providers/azure-ad";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import { createAppleClientSecret } from "./apple-client-secret";
import { mapOAuthUser, type OAuthProfile } from "./oauth-linking";

export type OAuthEnv = Record<string, string | undefined>;

export type ConfiguredOAuthProviderId = "google" | "facebook" | "apple" | "azure-ad";

const FACEBOOK_GRAPH_VERSION = "v23.0";

function present(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function first(...values: Array<string | undefined>): string | undefined {
  return values.find(present)?.trim();
}

function mappedProfile(provider: ConfiguredOAuthProviderId, profile: OAuthProfile) {
  return mapOAuthUser(provider, profile);
}

export function listConfiguredOAuthProviders(env: OAuthEnv = process.env): ConfiguredOAuthProviderId[] {
  const ids: ConfiguredOAuthProviderId[] = [];
  if (present(env.GOOGLE_CLIENT_ID) && present(env.GOOGLE_CLIENT_SECRET)) ids.push("google");
  if (present(env.FACEBOOK_CLIENT_ID) && present(env.FACEBOOK_CLIENT_SECRET)) ids.push("facebook");
  if (
    present(env.APPLE_CLIENT_ID) &&
    present(env.APPLE_TEAM_ID) &&
    present(env.APPLE_KEY_ID) &&
    present(env.APPLE_PRIVATE_KEY)
  ) {
    ids.push("apple");
  }
  if (
    first(env.AZURE_AD_CLIENT_ID, env.MICROSOFT_CLIENT_ID) &&
    first(env.AZURE_AD_CLIENT_SECRET, env.MICROSOFT_CLIENT_SECRET)
  ) {
    ids.push("azure-ad");
  }
  return ids;
}

export function createOAuthProviders(env: OAuthEnv = process.env): Provider[] {
  const providers: Provider[] = [];
  const enabled = new Set(listConfiguredOAuthProviders(env));

  if (enabled.has("google")) {
    providers.push(
      GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID!.trim(),
        clientSecret: env.GOOGLE_CLIENT_SECRET!.trim(),
        authorization: {
          params: { prompt: "select_account", scope: "openid email profile" },
        },
        profile(profile) {
          return mappedProfile("google", profile);
        },
      })
    );
  }

  if (enabled.has("facebook")) {
    providers.push(
      FacebookProvider({
        clientId: env.FACEBOOK_CLIENT_ID!.trim(),
        clientSecret: env.FACEBOOK_CLIENT_SECRET!.trim(),
        authorization: `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth?scope=email,public_profile`,
        checks: ["state"],
        profile(profile) {
          return mappedProfile("facebook", profile);
        },
      })
    );
  }

  if (enabled.has("apple")) {
    const clientSecret = createAppleClientSecret({
      clientId: env.APPLE_CLIENT_ID!.trim(),
      teamId: env.APPLE_TEAM_ID!.trim(),
      keyId: env.APPLE_KEY_ID!.trim(),
      privateKey: env.APPLE_PRIVATE_KEY!,
    });
    if (!clientSecret) {
      console.error(
        "[auth] Apple est configuré mais APPLE_PRIVATE_KEY est illisible — fournisseur ignoré."
      );
    } else {
      providers.push(
        AppleProvider({
          clientId: env.APPLE_CLIENT_ID!.trim(),
          clientSecret,
          profile(profile) {
            return mappedProfile("apple", profile);
          },
        })
      );
    }
  }

  if (enabled.has("azure-ad")) {
    const clientId = first(env.AZURE_AD_CLIENT_ID, env.MICROSOFT_CLIENT_ID)!;
    const clientSecret = first(env.AZURE_AD_CLIENT_SECRET, env.MICROSOFT_CLIENT_SECRET)!;
    const tenantId = first(env.AZURE_AD_TENANT_ID, env.MICROSOFT_TENANT_ID) ?? "common";
    providers.push(
      AzureADProvider({
        clientId,
        clientSecret,
        tenantId,
        // Pas d'appel Graph pour la photo : le scope `openid profile email`
        // ne garantit pas User.Read, et un 404 photo ne doit pas faire échouer
        // la connexion sur Vercel.
        profile(profile) {
          return mappedProfile("azure-ad", profile);
        },
      })
    );
  }

  return providers;
}
