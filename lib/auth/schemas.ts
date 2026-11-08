import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "./password";
import { PORTFOLIO_TYPE_IDS } from "@/lib/portfolio-types";
import {
  INVESTOR_CAPACITIES,
  INVESTOR_HORIZONS,
  INVESTOR_LOSS_TOLERANCES,
  INVESTOR_OBJECTIVES,
} from "@/lib/portfolio-analysis/criteria";

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

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email("Adresse email invalide").optional(),
    preferredPortfolioType: z.enum(PORTFOLIO_TYPE_IDS).nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.email !== undefined ||
      value.preferredPortfolioType !== undefined,
    {
      message: "Aucun champ à mettre à jour",
    }
  );

export const investorProfileSchema = z
  .object({
    age: z.number().int().min(18).max(100).nullable().optional(),
    horizon: z.enum(INVESTOR_HORIZONS).nullable().optional(),
    capacity: z.enum(INVESTOR_CAPACITIES).nullable().optional(),
    lossTolerance: z.enum(INVESTOR_LOSS_TOLERANCES).nullable().optional(),
    objective: z.enum(INVESTOR_OBJECTIVES).nullable().optional(),
    investableCapitalFcfa: z.number().positive().max(1e15).nullable().optional(),
    riskPerPositionPct: z.number().min(0.5).max(2).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Aucun champ à mettre à jour",
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`),
});
