import { prisma } from "@/lib/prisma";
import { consumeAuthToken } from "./tokens";

export type VerifyEmailResult =
  | { ok: true; alreadyVerified?: boolean }
  | { ok: false; reason: "invalid" | "missing" };

export async function verifyEmailWithToken(rawToken: string | undefined | null): Promise<VerifyEmailResult> {
  if (!rawToken || rawToken.trim().length < 16) return { ok: false, reason: "missing" };

  const consumed = await consumeAuthToken(rawToken.trim(), "EMAIL_VERIFY");
  if (!consumed) return { ok: false, reason: "invalid" };

  await prisma.user.update({
    where: { id: consumed.userId },
    data: { emailVerified: new Date() },
  });

  return { ok: true };
}
