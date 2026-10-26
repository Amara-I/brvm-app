import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { getI18n } from "@/lib/i18n/get-i18n";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return {
    title: t("directory.news.metaTitle"),
    description: t("directory.news.metaDescription"),
  };
}

export default async function ActualitesPage() {
  const { t, format } = getI18n();
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
          kicker={t("directory.news.kicker")}
          title={t("directory.news.title")}
          lead={t("directory.news.lead")}
        />

        {articles.length === 0 ? (
          <EmptyState title={t("directory.news.emptyTitle")} body={t("directory.news.emptyBody")} />
        ) : (
          <div className="ob-news-list">
            {articles.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="ob-news-card">
                <div className="ob-news-meta">
                  {a.sourceName} ·{" "}
                  {format.date(a.publishedAt, { day: "2-digit", month: "2-digit", year: "numeric" })}
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
