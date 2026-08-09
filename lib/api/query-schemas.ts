// Schémas Zod de validation des paramètres de requête des API routes.
import { z } from "zod";

/// GET /api/companies — liste avec filtres secteur/pays, tri, pagination.
export const companiesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /// Slug du secteur (cf. Sector.slug), ex: "banques", "telecoms".
  sector: z.string().trim().min(1).optional(),
  /// Code ISO pays (cf. Country.code), ex: "CI", "SN".
  country: z.string().trim().length(2).toUpperCase().optional(),
  sortBy: z.enum(["name", "ticker", "mktcap", "per", "listedSince"]).default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});
export type CompaniesListQuery = z.infer<typeof companiesListQuerySchema>;

/// GET /api/companies/:ticker/projections — horizon de projection en années.
export const projectionsQuerySchema = z.object({
  years: z.coerce.number().int().min(1).max(10).default(5),
});

/// GET /api/market/news — pagination simple.
export const newsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  /// Filtre optionnel sur une société précise (ticker).
  ticker: z.string().trim().toUpperCase().optional(),
});
