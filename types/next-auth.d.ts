// Augmentation des types NextAuth.js — étape 7 du plan de migration
// Expose `id` et `role` (cf. modèle Prisma `User`) sur la session et le JWT,
// pour pouvoir protéger les routes API par rôle (ADMIN pour une future
// interface de résolution des écarts, cf. brief § fallback manuel).
import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
