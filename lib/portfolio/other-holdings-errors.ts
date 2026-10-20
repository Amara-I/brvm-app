import { Prisma } from "@prisma/client";

/** Table pas encore créée (migration non appliquée). Les actions restent lisibles. */
export function isMissingOtherHoldingsTable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /portfolio_other_holdings/i.test(message) && /does not exist|n'existe pas/i.test(message);
}
