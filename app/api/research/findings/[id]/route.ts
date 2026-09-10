// PATCH /api/research/findings/[id] — valider (RETENU) ou rejeter (REJETE) une trouvaille.

import { NextRequest } from "next/server";
import { z } from "zod";
import { ResearchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiSuccess, apiError, apiNotFound, apiValidationError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.enum(["RETENU", "REJETE", "APPLIQUE", "NOUVEAU"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise pour trancher une proposition", 401);

  const existing = await prisma.researchFinding.findUnique({ where: { id: params.id } });
  if (!existing) return apiNotFound("Proposition / finding");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  const updated = await prisma.researchFinding.update({
    where: { id: params.id },
    data: {
      status: parsed.data.status as ResearchStatus,
      reviewedAt: new Date(),
      reviewedBy: userId,
    },
  });

  return apiSuccess({
    id: updated.id,
    status: updated.status,
    title: updated.title,
  });
}
