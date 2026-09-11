// Page "Actualités" — étape 10 (navigation complète).
// Branché directement sur la table `news_articles` (même requête que
// `GET /api/market/news`, étape 4). ⚠️ Table non encore alimentée par un
// connecteur dédié (annoncé comme différé dès l'étape 4) : l'état vide est
// donc honnête, pas un placeholder trompeur.
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { PAGE_LEAD, PAGE_TITLE } from "@/lib/theme/typography";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Actualités — OuestBourse",
  description: "Actualités du marché BRVM agrégées depuis les sources officielles et partenaires.",
};

export default async function ActualitesPage() {
  const articles = await prisma.newsArticle
    .findMany({
      include: { company: { select: { ticker: true, name: true } } },
      orderBy: { publishedAt: "desc" },
      take: 30,
    })
    .catch(() => []);

  return (
    <AppHeader>
      <div>
        <h1 style={PAGE_TITLE}>📰 Actualités</h1>
        <p style={PAGE_LEAD}>
          L&apos;essentiel du marché BRVM, agrégé depuis BRVM officiel, Sikafinance et Richbourse.
        </p>

        {articles.length === 0 ? (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, textAlign: "center" }}>
            <p style={{ color: C.textDim, fontSize: "var(--fs-body-sm)", margin: 0 }}>
              Aucune actualité pour l&apos;instant — l&apos;ingestion automatique des actualités n&apos;est pas encore activée
              (cf. feuille de route, AGENTS.md).
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-align-left>
            {articles.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, textDecoration: "none", textAlign: "left" }}
              >
                <div style={{ color: C.textDim, fontSize: "var(--fs-body-xs)", marginBottom: 6 }}>
                  {a.sourceName} · {new Date(a.publishedAt).toLocaleDateString("fr-FR")}
                  {a.company ? ` · ${a.company.ticker}` : ""}
                </div>
                <div style={{ color: C.text, fontSize: "var(--fs-body-sm)", fontWeight: 700, marginBottom: 4 }}>{a.title}</div>
                {a.summary && <div style={{ color: C.textDim, fontSize: "var(--fs-body-sm)" }}>{a.summary}</div>}
              </a>
            ))}
          </div>
        )}
      </div>
    </AppHeader>
  );
}
