import { createHash, randomBytes } from "node:crypto";
import type { AuthTokenType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function generateAuthTokenSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAuthToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function ttlForAuthTokenType(type: AuthTokenType): number {
  return type === "PASSWORD_RESET" ? PASSWORD_RESET_TTL_MS : EMAIL_VERIFY_TTL_MS;
}

export function isAuthTokenCurrentlyValid(token: {
  type: AuthTokenType;
  usedAt: Date | null;
  expiresAt: Date;
}, expectedType: AuthTokenType, now = Date.now()): boolean {
  if (token.type !== expectedType) return false;
  if (token.usedAt) return false;
  if (token.expiresAt.getTime() <= now) return false;
  return true;
}

/// Émet un jeton one-shot. Invalide les jetons non utilisés du même type.
/// Retourne `null` si la table n'existe pas encore (migration pas appliquée).
export async function issueAuthToken(userId: string, type: AuthTokenType): Promise<string | null> {
  const raw = generateAuthTokenSecret();
  const tokenHash = hashAuthToken(raw);
  const expiresAt = new Date(Date.now() + ttlForAuthTokenType(type));

  try {
    await prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.authToken.create({
      data: { userId, type, tokenHash, expiresAt },
    });
    return raw;
  } catch (error) {
    console.error("[auth] issueAuthToken a échoué (migration auth_tokens manquante ?)", error);
    return null;
  }
}

export async function peekAuthToken(
  raw: string,
  type: AuthTokenType
): Promise<{ userId: string; tokenId: string } | null> {
  const tokenHash = hashAuthToken(raw);
  try {
    const token = await prisma.authToken.findUnique({ where: { tokenHash } });
    if (!token || !isAuthTokenCurrentlyValid(token, type)) return null;
    return { userId: token.userId, tokenId: token.id };
  } catch (error) {
    console.error("[auth] peekAuthToken a échoué", error);
    return null;
  }
}

export async function consumeAuthToken(
  raw: string,
  type: AuthTokenType
): Promise<{ userId: string } | null> {
  const peeked = await peekAuthToken(raw, type);
  if (!peeked) return null;

  try {
    const updated = await prisma.authToken.updateMany({
      where: { id: peeked.tokenId, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (updated.count === 0) return null;
    return { userId: peeked.userId };
  } catch (error) {
    console.error("[auth] consumeAuthToken a échoué", error);
    return null;
  }
}
