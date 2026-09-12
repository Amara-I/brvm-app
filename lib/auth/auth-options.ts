// ═══════════════════════════════════════════════════════════════════════════
// Configuration NextAuth.js — étape 7 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Deux méthodes de connexion, comme demandé dans le brief :
//   - Email / mot de passe (`CredentialsProvider`), vérifié contre
//     `User.passwordHash` (bcrypt) — inscription via `POST /api/auth/register`.
//   - Google OAuth (`GoogleProvider`), activé UNIQUEMENT si
//     `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` sont renseignés (cf.
//     .env.example) — évite une erreur au démarrage si non configuré.
//
// Stratégie de session : JWT (obligatoire avec `CredentialsProvider` dans
// NextAuth v4 — les sessions "database" ne sont pas supportées avec les
// providers Credentials). `PrismaAdapter` reste branché pour la persistance
// des comptes/liens OAuth (Google) et restera utile pour un futur provider
// supplémentaire.
// ═══════════════════════════════════════════════════════════════════════════

import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "./admin-emails";

const providers: AuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email et mot de passe",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Mot de passe", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password) return null;

      const user = await prisma.user.findUnique({ where: { email: credentials.email.toLowerCase() } });
      // `passwordHash` null = compte créé uniquement via OAuth (Google) →
      // pas de mot de passe à vérifier, connexion par Credentials refusée.
      if (!user || !user.passwordHash) return null;

      const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isValid) return null;

      return { id: user.id, email: user.email, name: user.name, role: user.role };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  // Page de connexion custom prévue à l'étape 8 (façon Ouestbourse :
  // "Connexion/Créer un compte") — NextAuth utilise sa page par défaut tant
  // qu'elle n'existe pas, sans erreur.
  pages: { signIn: "/connexion" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      if (token.email && isAdminEmail(String(token.email))) {
        token.role = "ADMIN";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role ?? "USER";
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/portefeuille`;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
