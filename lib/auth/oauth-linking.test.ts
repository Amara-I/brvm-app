import { describe, expect, it } from "vitest";
import { isAdminEmail } from "./admin-emails";
import { AUTH_ERROR_MESSAGES, authErrorMessage, OAUTH_SIGN_IN_BUTTONS } from "./oauth-errors";
import {
  cleanOAuthImage,
  cleanOAuthName,
  isOAuthEmailVerified,
  mapOAuthUser,
  normalizeOAuthEmail,
  resolveOAuthSignIn,
  type ExistingOAuthUser,
  type OAuthAccountRepository,
  type OAuthAccountWrite,
  type OAuthTokenFields,
} from "./oauth-linking";

const TOKENS: OAuthTokenFields = {
  type: "oauth",
  refresh_token: null,
  access_token: "access",
  expires_at: 1_700_000_000,
  token_type: "Bearer",
  scope: "email",
  id_token: null,
  session_state: null,
};

type MemoryUser = ExistingOAuthUser & { passwordHash: string | null };

function memoryRepo(users: MemoryUser[]) {
  const accounts: Array<OAuthAccountWrite & { userId: string }> = [];
  const verified: Array<{ userId: string; at: Date }> = [];
  const repo: OAuthAccountRepository = {
    async findLinkedAccount(provider, providerAccountId) {
      const account = accounts.find(
        (row) => row.provider === provider && row.providerAccountId === providerAccountId
      );
      if (!account) return null;
      const user = users.find((row) => row.id === account.userId);
      if (!user) return null;
      return { userId: user.id, role: user.role, emailVerified: user.emailVerified };
    },
    async findUserByEmail(email) {
      return users.find((row) => row.email.toLowerCase() === email.toLowerCase()) ?? null;
    },
    async markEmailVerified(userId, at) {
      const user = users.find((row) => row.id === userId);
      if (user && !user.emailVerified) user.emailVerified = at;
      verified.push({ userId, at });
    },
    async linkAccount(userId, account) {
      accounts.push({ ...account, userId });
    },
  };
  return { repo, accounts, verified, users };
}

const admin = (): MemoryUser => ({
  id: "user-admin",
  email: "owner@ouestbourse.test",
  role: "ADMIN",
  emailVerified: new Date("2024-01-01T00:00:00.000Z"),
  passwordHash: "hashed-password",
});

describe("normalizeOAuthEmail / images", () => {
  it("met l'email en minuscules et rejette les valeurs inutilisables", () => {
    expect(normalizeOAuthEmail("  Owner@OuestBourse.test ")).toBe("owner@ouestbourse.test");
    expect(normalizeOAuthEmail("pas-un-email")).toBeNull();
    expect(normalizeOAuthEmail(12)).toBeNull();
    expect(cleanOAuthImage("javascript:alert(1)")).toBeNull();
    expect(cleanOAuthImage("https://lh3.googleusercontent.com/a/photo")).toMatch(/^https:\/\//);
    expect(cleanOAuthName("  Awa\u0000 Diop ")).toBe("Awa Diop");
  });
});

describe("isOAuthEmailVerified", () => {
  it("n'accepte Google que si email_verified est vrai", () => {
    expect(isOAuthEmailVerified("google", { email: "a@b.co", email_verified: true }, "a@b.co")).toBe(true);
    expect(isOAuthEmailVerified("google", { email: "a@b.co", email_verified: false }, "a@b.co")).toBe(false);
    expect(isOAuthEmailVerified("google", { email: "a@b.co" }, "a@b.co")).toBe(false);
  });

  it("accepte Apple quand le claim est la chaîne \"true\"", () => {
    expect(isOAuthEmailVerified("apple", { email: "a@b.co", email_verified: "true" }, "a@b.co")).toBe(true);
    expect(isOAuthEmailVerified("apple", { email: "a@b.co", email_verified: "false" }, "a@b.co")).toBe(false);
  });

  it("traite l'email Facebook comme confirmé, et son absence comme non confirmé", () => {
    expect(isOAuthEmailVerified("facebook", { email: "a@b.co" }, "a@b.co")).toBe(true);
    expect(isOAuthEmailVerified("facebook", { id: "1" }, null)).toBe(false);
  });

  it("n'utilise pas preferred_username seul comme preuve Microsoft", () => {
    expect(
      isOAuthEmailVerified("azure-ad", { preferred_username: "a@b.co" }, "a@b.co")
    ).toBe(false);
    expect(isOAuthEmailVerified("azure-ad", { email: "a@b.co" }, "a@b.co")).toBe(true);
    expect(
      isOAuthEmailVerified("azure-ad", { email: "a@b.co", email_verified: false }, "a@b.co")
    ).toBe(false);
  });
});

describe("resolveOAuthSignIn", () => {
  it("lie un compte email+mot de passe dont Google confirme l'adresse, sans toucher au rôle", async () => {
    const user = admin();
    const { repo, accounts, users } = memoryRepo([user]);
    const result = await resolveOAuthSignIn(
      {
        provider: "google",
        providerAccountId: "google-sub",
        profile: { email: "Owner@OuestBourse.test", email_verified: true, name: "Intrus" },
        tokens: TOKENS,
      },
      repo
    );

    expect(result).toEqual({ ok: true });
    expect(accounts).toEqual([
      expect.objectContaining({
        userId: "user-admin",
        provider: "google",
        providerAccountId: "google-sub",
      }),
    ]);
    expect(users[0]).toMatchObject({
      id: "user-admin",
      email: "owner@ouestbourse.test",
      role: "ADMIN",
      passwordHash: "hashed-password",
    });
    expect(isAdminEmail(users[0].email, "owner@ouestbourse.test")).toBe(true);
    expect(accounts[0]).not.toHaveProperty("role");
  });

  it("refuse de lier un email non confirmé (pas de prise de compte)", async () => {
    const { repo, accounts, verified } = memoryRepo([admin()]);
    const result = await resolveOAuthSignIn(
      {
        provider: "google",
        providerAccountId: "attacker",
        profile: { email: "owner@ouestbourse.test", email_verified: false },
        tokens: TOKENS,
      },
      repo
    );
    expect(result).toEqual({ ok: false, error: "OAuthUnverifiedEmail" });
    expect(accounts).toHaveLength(0);
    expect(verified).toHaveLength(0);
  });

  it("refuse Facebook sans email et n'écrit rien", async () => {
    const { repo, accounts } = memoryRepo([]);
    const result = await resolveOAuthSignIn(
      {
        provider: "facebook",
        providerAccountId: "fb-1",
        profile: { id: "fb-1", name: "Sans email" },
        tokens: TOKENS,
      },
      repo
    );
    expect(result).toEqual({ ok: false, error: "OAuthNoEmail" });
    expect(accounts).toHaveLength(0);
    expect(authErrorMessage("OAuthNoEmail")).toMatch(/Facebook/);
  });

  it("lie Facebook quand l'email est transmis", async () => {
    const user = { ...admin(), emailVerified: null };
    const { repo, accounts, users } = memoryRepo([user]);
    const at = new Date("2026-10-20T12:00:00.000Z");
    const result = await resolveOAuthSignIn(
      {
        provider: "facebook",
        providerAccountId: "fb-9",
        profile: { email: "owner@ouestbourse.test", name: "Awa" },
        tokens: TOKENS,
        now: at,
      },
      repo
    );
    expect(result).toEqual({ ok: true });
    expect(accounts[0]?.provider).toBe("facebook");
    expect(users[0].emailVerified).toEqual(at);
    expect(users[0].role).toBe("ADMIN");
  });

  it("laisse NextAuth créer un nouvel utilisateur Google vérifié, sans écriture anticipée", async () => {
    const { repo, accounts, verified } = memoryRepo([]);
    const mapped = mapOAuthUser(
      "google",
      { sub: "g1", email: "Neuve@Example.com", email_verified: true, name: "Neuve", picture: "https://img.example/a.png" },
      new Date("2026-10-20T00:00:00.000Z")
    );
    const result = await resolveOAuthSignIn(
      {
        provider: "google",
        providerAccountId: "g1",
        profile: { sub: "g1", email: "Neuve@Example.com", email_verified: true, name: "Neuve" },
        tokens: TOKENS,
      },
      repo
    );
    expect(result).toEqual({ ok: true });
    expect(accounts).toHaveLength(0);
    expect(verified).toHaveLength(0);
    expect(mapped).toMatchObject({
      id: "g1",
      email: "neuve@example.com",
      role: "USER",
      image: "https://img.example/a.png",
    });
    expect(mapped.emailVerified).toBeInstanceOf(Date);
  });

  it("ne marque pas vérifié un nouveau compte dont le fournisseur ne confirme pas l'email", () => {
    const mapped = mapOAuthUser("google", { sub: "g2", email: "x@y.z", email_verified: false });
    expect(mapped.email).toBe("x@y.z");
    expect(mapped.emailVerified).toBeNull();
    expect(mapped.role).toBe("USER");
  });

  it("laisse passer un compte déjà lié même si ce jeton n'a plus d'email", async () => {
    const user = admin();
    const { repo, accounts } = memoryRepo([user]);
    accounts.push({
      ...TOKENS,
      userId: user.id,
      provider: "facebook",
      providerAccountId: "fb-known",
    });
    const result = await resolveOAuthSignIn(
      {
        provider: "facebook",
        providerAccountId: "fb-known",
        profile: { id: "fb-known" },
        tokens: TOKENS,
      },
      repo
    );
    expect(result).toEqual({ ok: true });
    expect(accounts).toHaveLength(1);
  });

  it("lie Apple et Microsoft seulement si l'adresse est confirmée", async () => {
    const appleUser = admin();
    const msUser: MemoryUser = {
      id: "user-ms",
      email: "ms@ouestbourse.test",
      role: "USER",
      emailVerified: null,
      passwordHash: "hash",
    };
    const { repo, accounts, users } = memoryRepo([appleUser, msUser]);

    expect(
      await resolveOAuthSignIn(
        {
          provider: "apple",
          providerAccountId: "apple-sub",
          profile: { email: "owner@ouestbourse.test", email_verified: "true" },
          tokens: TOKENS,
        },
        repo
      )
    ).toEqual({ ok: true });

    expect(
      await resolveOAuthSignIn(
        {
          provider: "azure-ad",
          providerAccountId: "ms-sub",
          profile: { preferred_username: "ms@ouestbourse.test" },
          tokens: TOKENS,
        },
        repo
      )
    ).toEqual({ ok: false, error: "OAuthUnverifiedEmail" });

    expect(
      await resolveOAuthSignIn(
        {
          provider: "azure-ad",
          providerAccountId: "ms-sub",
          profile: { email: "ms@ouestbourse.test", sub: "ms-sub" },
          tokens: TOKENS,
          now: new Date("2026-10-20T00:00:00.000Z"),
        },
        repo
      )
    ).toEqual({ ok: true });

    expect(accounts.map((row) => row.provider)).toEqual(["apple", "azure-ad"]);
    expect(users.find((row) => row.id === "user-ms")?.emailVerified).toBeInstanceOf(Date);
    expect(users.find((row) => row.id === "user-admin")?.role).toBe("ADMIN");
  });
});

describe("messages et libellés", () => {
  it("couvre les erreurs OAuth en français", () => {
    expect(authErrorMessage("OAuthUnverifiedEmail")).toBe(AUTH_ERROR_MESSAGES.OAuthUnverifiedEmail);
    expect(authErrorMessage("inconnu")).toBe(AUTH_ERROR_MESSAGES.Default);
    expect(OAUTH_SIGN_IN_BUTTONS.map((button) => button.label)).toEqual([
      "Continuer avec Google",
      "Continuer avec Facebook",
      "Continuer avec Apple",
      "Continuer avec Microsoft",
    ]);
  });
});
