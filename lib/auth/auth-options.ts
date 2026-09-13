// ═══════════════════════════════════════════════════════════════════════════
// Configuration NextAuth.js — étape 7 + flux login / logout / email (2026-09)
// ═══════════════════════════════════════════════════════════════════════════
// Deux méthodes de connexion :
//   - Email / mot de passe (`CredentialsProvider`), vérifié contre
//     `User.passwordHash` (bcrypt) — inscription via `POST /api/auth/register`.
//   - Google OAuth (`GoogleProvider`), activé UNIQUEMENT si
//     `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` sont renseignés.
//
// Confirmation d'email : souple (soft gate). Un compte Credentials peut
// se connecter avant vérification ; un bandeau invite à confirmer.
// Google marque `emailVerified` dès la première connexion OAuth.
//
// Stratégie de session : JWT (obligatoire avec Credentials dans NextAuth v4).
// `PrismaAdapter` persiste les comptes/liens OAuth.
// ═══════════════════════════════════════════════════════════════════════════

import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "./admin-emails";
import { verifyPassword } from "./password";
import { loginCredentialsSchema } from "./schemas";

const providers: AuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email et mot de passe",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Mot de passe", type: "password" },
    },
    async authorize(credentials) {
      const parsed = loginCredentialsSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
      });
      // `passwordHash` null = compte créé uniquement via OAuth (Google) →
      // pas de mot de passe à vérifier, connexion par Credentials refusée.
      if (!user || !user.passwordHash) return null;

      const isValid = await verifyPassword(parsed.data.password, user.passwordHash);
      if (!isValid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Un compte déjà créé en email/mot de passe peut ensuite se lier à
      // Google (même adresse). Google a déjà vérifié l'email.
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/connexion",
    signOut: "/deconnexion",
    error: "/connexion",
  },
  providers,
  events: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.id) return;
      try {
        await prisma.user.updateMany({
          where: { id: user.id, emailVerified: null },
          data: { emailVerified: new Date() },
        });
      } catch (error) {
        console.error("[auth] impossible de marquer emailVerified après Google", error);
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "USER";
        token.emailVerified = Boolean(user.emailVerified);
      }

      // Rafraîchir depuis la base : à la connexion (rôle ADMIN Prisma) et tant
      // que l'email n'est pas confirmé (soft gate → bandeau disparaît sans re-login).
      if (token.id && (user || token.emailVerified !== true)) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: String(token.id) },
            select: { emailVerified: true, role: true },
          });
          if (fresh) {
            token.emailVerified = Boolean(fresh.emailVerified);
            token.role = fresh.role;
          }
        } catch {
          // Base injoignable : on conserve le JWT tel quel.
        }
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
        session.user.emailVerified = token.emailVerified === true;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        // URL mal formée → accueil
      }
      // Déconnexion / retours inattendus : landing, jamais /portefeuille.
      return baseUrl;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
