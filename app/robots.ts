// robots.txt généré — étape 9 (checklist de conformité, volet SEO/perf).
// Autorise l'indexation des pages publiques, exclut l'API et les routes
// d'authentification (aucun intérêt SEO, évite le crawl inutile de routes
// dynamiques coûteuses en base de données).
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
  };
}
