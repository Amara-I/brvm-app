import { getCurrentUser } from "@/lib/auth/get-current-user";
import { enforceAnonGates, type ViewerPlan } from "./plans";
import { planAllows, type Feature } from "./features";

export type Viewer = {
  /** Null si visiteur (pas de session). */
  userId: string | null;
  /**
   * Palier nominal. Étape 1 : ANON si non connecté, sinon FREE
   * (on ne lit pas encore `User.plan` en base, la colonne peut manquer
   * tant que la migration n'est pas appliquée).
   */
  plan: ViewerPlan;
  /**
   * Palier effectif pour le gating. Étape 1 : PREMIUM dès qu'un compte
   * est connecté, ou si ENFORCE_ANON_GATES est désactivé ; sinon ANON.
   */
  accessPlan: ViewerPlan;
  /** Vrai uniquement pour un visiteur soumis aux restrictions. */
  gated: boolean;
};

export const ANON_VIEWER: Viewer = {
  userId: null,
  plan: "ANON",
  accessPlan: "ANON",
  gated: true,
};

export const FULL_ACCESS_VIEWER: Viewer = {
  userId: "full-access",
  plan: "FREE",
  accessPlan: "PREMIUM",
  gated: false,
};

export function viewerFromSession(userId: string | null, gatesOn = enforceAnonGates()): Viewer {
  if (userId) {
    return { userId, plan: "FREE", accessPlan: "PREMIUM", gated: false };
  }
  if (!gatesOn) {
    return { userId: null, plan: "ANON", accessPlan: "PREMIUM", gated: false };
  }
  return { ...ANON_VIEWER };
}

export async function getViewer(): Promise<Viewer> {
  const user = await getCurrentUser().catch(() => null);
  return viewerFromSession(user?.id ?? null);
}

export function can(viewer: Viewer, feature: Feature): boolean {
  return planAllows(viewer.accessPlan, feature);
}
