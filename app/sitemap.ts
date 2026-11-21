// sitemap.xml généré : pages publiques, fiches sociétés BRVM et contenu
// pédagogique. Les routes privées (portefeuille, profil, admin, API) en sont
// volontairement absentes (cf. app/robots.ts).
import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/auth/app-url";
import { getCompaniesNavIndex } from "@/lib/api/companies-nav-index";
import { EDUCATION_TERMS, EDUCATION_THEMES } from "@/lib/education/catalog";

const STATIC_PATHS = [
  "/",
  "/marche",
  "/screener",
  "/societes-cotees",
  "/indices",
  "/graphes",
  "/actualites",
  "/calendrier-dividendes",
  "/outils",
  "/outils/taille-position",
  "/simulation",
  "/education",
  "/marches/ngx",
  "/marches/ngx/screener",
  "/marches/ngx/societes",
  "/marches/ngx/dividendes",
  "/marches/ngx/indices",
  "/mentions-legales",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppBaseUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" || path === "/marche" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  // Fiches sociétés : si la base est injoignable, le sitemap reste valide
  // (sans ces URL) au lieu de renvoyer une 500 aux robots.
  try {
    const { companies } = await getCompaniesNavIndex();
    for (const c of companies) {
      entries.push({
        url: `${base}/actions/${encodeURIComponent(c.ticker)}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch (err) {
    console.error("[sitemap] fiches sociétés ignorées —", err instanceof Error ? err.message : err);
  }

  for (const theme of EDUCATION_THEMES) {
    entries.push({
      url: `${base}/education/${theme.slug}`,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }
  for (const term of EDUCATION_TERMS) {
    entries.push({
      url: `${base}/education/${term.themeSlug}/${term.slug}`,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  return entries;
}
