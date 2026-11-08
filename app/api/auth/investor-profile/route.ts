import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, apiValidationError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { investorProfileSchema } from "@/lib/auth/schemas";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { getI18n } from "@/lib/i18n/get-i18n";
import { isMissingInvestorProfileTable } from "@/lib/portfolio-analysis/missing-table";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const { t } = getI18n();
  const user = await getCurrentUser();
  if (!user?.id) return apiError(t("common.api.authRequired"), 401);

  const body = await request.json().catch(() => null);
  const parsed = investorProfileSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const data = parsed.data;
  try {
    const saved = await prisma.investorProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        age: data.age ?? null,
        horizon: data.horizon ?? null,
        capacity: data.capacity ?? null,
        lossTolerance: data.lossTolerance ?? null,
        objective: data.objective ?? null,
        investableCapitalFcfa: data.investableCapitalFcfa ?? null,
        riskPerPositionPct: data.riskPerPositionPct ?? null,
      },
      update: {
        ...(data.age !== undefined ? { age: data.age } : {}),
        ...(data.horizon !== undefined ? { horizon: data.horizon } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.lossTolerance !== undefined ? { lossTolerance: data.lossTolerance } : {}),
        ...(data.objective !== undefined ? { objective: data.objective } : {}),
        ...(data.investableCapitalFcfa !== undefined
          ? { investableCapitalFcfa: data.investableCapitalFcfa }
          : {}),
        ...(data.riskPerPositionPct !== undefined ? { riskPerPositionPct: data.riskPerPositionPct } : {}),
      },
    });

    return apiSuccess({
      age: saved.age,
      horizon: saved.horizon,
      capacity: saved.capacity,
      lossTolerance: saved.lossTolerance,
      objective: saved.objective,
      investableCapitalFcfa: saved.investableCapitalFcfa != null ? Number(saved.investableCapitalFcfa) : null,
      riskPerPositionPct: saved.riskPerPositionPct != null ? Number(saved.riskPerPositionPct) : null,
    });
  } catch (error) {
    if (isMissingInvestorProfileTable(error)) {
      return apiError(t("auth.profile.investorMigration"), 503);
    }
    if (isDatabaseUnavailable(error)) return apiError(t("common.unavailable"), 503);
    throw error;
  }
}
