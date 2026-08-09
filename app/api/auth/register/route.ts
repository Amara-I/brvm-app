// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/register — Création de compte (email/mot de passe), étape 7
// ═══════════════════════════════════════════════════════════════════════════
// NextAuth.js (`CredentialsProvider`) ne fournit pas d'inscription : cette
// route crée l'utilisateur (mot de passe haché via bcrypt), qui peut ensuite
// se connecter via `POST /api/auth/callback/credentials` (flux standard
// NextAuth) avec les mêmes identifiants.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  name: z.string().trim().min(1).max(120).optional(),
});

const BCRYPT_SALT_ROUNDS = 12;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return apiError("Un compte existe déjà avec cette adresse email", 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: parsed.data.name ?? null },
  });

  return apiSuccess({ id: user.id, email: user.email, name: user.name }, { status: 201 });
}
