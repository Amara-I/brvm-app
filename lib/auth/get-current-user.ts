// Helper partagé par les routes API protégées (portefeuille, futur admin) :
// résout l'utilisateur courant à partir du JWT NextAuth, sans dupliquer
// `getServerSession(authOptions)` partout.
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth-options";

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}
