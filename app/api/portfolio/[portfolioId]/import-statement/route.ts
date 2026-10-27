// POST /api/portfolio/:portfolioId/import-statement
// Prévisualise un relevé SGI (PDF texte, CSV, Excel). N'écrit rien en base
// et ne conserve pas le fichier : le buffer est parsé puis abandonné.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiError, apiNotFound, apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { STATEMENT_ERRORS, STATEMENT_MAX_BYTES, StatementImportError, statementErrorStatus } from "@/lib/portfolio/sgi-statement/messages";
import { parseStatementUpload } from "@/lib/portfolio/sgi-statement/parse-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: { portfolioId: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401, undefined);

  const portfolio = await prisma.portfolio.findUnique({ where: { id: params.portfolioId } });
  if (!portfolio || portfolio.userId !== userId) return apiNotFound("Portefeuille");

  const form = await request.formData().catch(() => null);
  if (!form) return apiError("Corps multipart attendu (champ « file »).", 400);

  const file = form.get("file");
  if (!(file instanceof File)) return apiError("Fichier manquant (champ « file »).", 400);
  if (file.size <= 0) return apiError(STATEMENT_ERRORS.EMPTY, 400);
  if (file.size > STATEMENT_MAX_BYTES) return apiError(STATEMENT_ERRORS.TOO_LARGE, 400);

  const companies = await prisma.company.findMany({
    where: { isActive: true, exchange: "BRVM" },
    select: { id: true, ticker: true, name: true, isin: true },
    orderBy: { ticker: "asc" },
  });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await parseStatementUpload(
      { filename: file.name || "releve", mime: file.type || "", bytes },
      companies
    );
    console.info("[sgi-statement] aperçu", {
      portfolioId: portfolio.id,
      bytes: file.size,
      rows: parsed.rows.length,
      layout: parsed.layoutId,
    });
    return apiSuccess(
      {
        ...parsed,
        companies: companies.map((company) => ({ id: company.id, ticker: company.ticker, name: company.name })),
      },
      { headers: privateCacheHeaders() }
    );
  } catch (error) {
    if (error instanceof StatementImportError) {
      return apiError(error.message, statementErrorStatus(error.code), { code: error.code });
    }
    console.error("[sgi-statement] échec aperçu", error instanceof Error ? error.message.slice(0, 180) : "erreur");
    return apiError(STATEMENT_ERRORS.UNREADABLE, 422, { code: "UNREADABLE" });
  }
}
