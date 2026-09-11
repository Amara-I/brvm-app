import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
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
      <div className="ob-page">
        <PageHeader
          kicker="Veille marché"
          title="Actualités"
          lead="L’essentiel du marché BRVM, agrégé depuis BRVM officiel, Sikafinance et Richbourse."
        />

        {articles.length === 0 ? (
          <EmptyState
            title="Aucune actualité pour l’instant"
            body="L’ingestion automatique des actualités n’est pas encore activée. Dès que les sources officielle et partenaires alimenteront le flux, les titres apparaîtront ici — rien n’est inventé en attendant."
          />
        ) : (
          <div className="ob-news-list">
            {articles.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="ob-news-card">
                <div className="ob-news-meta">
                  {a.sourceName} · {new Date(a.publishedAt).toLocaleDateString("fr-FR")}
                  {a.company ? ` · ${a.company.ticker}` : ""}
                </div>
                <h2 className="ob-news-title">{a.title}</h2>
                {a.summary ? <p className="ob-news-summary">{a.summary}</p> : null}
              </a>
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
