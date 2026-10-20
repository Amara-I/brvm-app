import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ExistingOAuthUser,
  LinkedOAuthAccount,
  OAuthAccountRepository,
  OAuthAccountWrite,
} from "./oauth-linking";

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function accountData(userId: string, account: OAuthAccountWrite) {
  return {
    userId,
    type: account.type,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    refresh_token: account.refresh_token,
    access_token: account.access_token,
    expires_at: account.expires_at,
    token_type: account.token_type,
    scope: account.scope,
    id_token: account.id_token,
    session_state: account.session_state,
  };
}

export function createOAuthAccountRepository(client: PrismaClient = prisma): OAuthAccountRepository {
  return {
    async findLinkedAccount(provider, providerAccountId): Promise<LinkedOAuthAccount | null> {
      const row = await client.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        select: {
          userId: true,
          user: { select: { role: true, emailVerified: true } },
        },
      });
      if (!row) return null;
      return {
        userId: row.userId,
        role: row.user.role,
        emailVerified: row.user.emailVerified,
      };
    },

    async findUserByEmail(email): Promise<ExistingOAuthUser | null> {
      const row = await client.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, email: true, role: true, emailVerified: true },
      });
      return row;
    },

    async markEmailVerified(userId, at) {
      await client.user.updateMany({
        where: { id: userId, emailVerified: null },
        data: { emailVerified: at },
      });
    },

    async linkAccount(userId, account) {
      await client.account.create({ data: accountData(userId, account) });
    },
  };
}
