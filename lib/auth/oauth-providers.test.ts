import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOAuthProviders, listConfiguredOAuthProviders } from "./oauth-providers";

const appleKey = generateKeyPairSync("ec", { namedCurve: "P-256" })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();

describe("listConfiguredOAuthProviders", () => {
  it("n'active rien sans identifiants", () => {
    expect(listConfiguredOAuthProviders({})).toEqual([]);
    expect(listConfiguredOAuthProviders({ GOOGLE_CLIENT_ID: "  ", GOOGLE_CLIENT_SECRET: "" })).toEqual([]);
    expect(createOAuthProviders({}).map((provider) => provider.id)).toEqual([]);
  });

  it("n'active un fournisseur que si le couple id/secret est complet", () => {
    expect(
      listConfiguredOAuthProviders({
        GOOGLE_CLIENT_ID: "google-id",
        GOOGLE_CLIENT_SECRET: "google-secret",
        FACEBOOK_CLIENT_ID: "fb-id",
      })
    ).toEqual(["google"]);
  });

  it("enregistre Google, Facebook, Apple et Microsoft quand les variables sont là", () => {
    const env = {
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      FACEBOOK_CLIENT_ID: "fb-id",
      FACEBOOK_CLIENT_SECRET: "fb-secret",
      APPLE_CLIENT_ID: "app.ouestbourse.web",
      APPLE_TEAM_ID: "TEAMID1234",
      APPLE_KEY_ID: "KEYID12345",
      APPLE_PRIVATE_KEY: appleKey,
      MICROSOFT_CLIENT_ID: "ms-id",
      MICROSOFT_CLIENT_SECRET: "ms-secret",
      MICROSOFT_TENANT_ID: "common",
    };
    expect(listConfiguredOAuthProviders(env)).toEqual(["google", "facebook", "apple", "azure-ad"]);
    const providers = createOAuthProviders(env);
    expect(providers.map((provider) => provider.id)).toEqual(["google", "facebook", "apple", "azure-ad"]);
    const apple = providers.find((provider) => provider.id === "apple") as {
      options?: {
        clientSecret?: string;
        profile?: (profile: Record<string, unknown>) => { email: string | null; emailVerified: Date | null };
      };
    };
    expect(apple.options?.clientSecret?.split(".")).toHaveLength(3);
    const mapped = apple.options?.profile?.({
      sub: "apple-sub",
      email: "A@B.co",
      email_verified: "true",
      name: "Awa",
    });
    expect(mapped?.email).toBe("a@b.co");
    expect(mapped?.emailVerified).toBeInstanceOf(Date);
  });

  it("ignore Apple si la clé privée est illisible, sans bloquer les autres", () => {
    const providers = createOAuthProviders({
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      APPLE_CLIENT_ID: "app.ouestbourse.web",
      APPLE_TEAM_ID: "TEAM",
      APPLE_KEY_ID: "KEY",
      APPLE_PRIVATE_KEY: "clé cassée",
    });
    expect(providers.map((provider) => provider.id)).toEqual(["google"]);
  });
});
