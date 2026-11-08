import { Prisma } from "@prisma/client";

/** Migration `investor_profiles` pas encore appliquée. L'analyse continue sans critères. */
export function isMissingInvestorProfileTable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /investor_profiles/i.test(message) && /does not exist|n'existe pas/i.test(message);
}
