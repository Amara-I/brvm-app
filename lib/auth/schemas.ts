import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "./password";

export const registerSchema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`),
  name: z.string().trim().min(1).max(120).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16, "Lien de réinitialisation invalide"),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`),
});

export const loginCredentialsSchema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});
