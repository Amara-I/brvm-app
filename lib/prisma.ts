// Singleton PrismaClient — pattern standard Next.js pour éviter d'épuiser les
// connexions à la base lors du hot-reload en développement (`next dev`
// recharge les modules mais réutilise le processus Node).
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
