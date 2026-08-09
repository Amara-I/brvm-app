// Page "Actualités" — étape 10 (navigation complète).
// Branché directement sur la table `news_articles` (même requête que
// `GET /api/market/news`, étape 4). ⚠️ Table non encore alimentée par un
// connecteur dédié (annoncé comme différé dès l'étape 4) : l'état vide est
// donc honnête, pas un placeholder trompeur.
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Actualités — ouestBourse",
  description: "Actualités du marché BRVM agrégées depuis les sources officielles et partenaires.",
};

export default async function ActualitesPage() {
  const articles = await prisma.newsArticle.findMany({
    include: { company: { select: { ticker: true, name: true } } },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Trebuchet MS', Georgia, serif" }}>
      <AppHeader />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ color: C.text, fontSize: "1.4rem", marginBottom: 4 }}>📰 Actualités</h1>
        <p style={{ color: C.textDim, fontSize: "0.85rem", marginBottom: 24 }}>
          L&apos;essentiel du marché BRVM, agrégé depuis BRVM officiel, Sikafinance et Richbourse.
        </p>

        {articles.length === 0 ? (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, textAlign: "center" }}>
            <p style={{ color: C.textDim, fontSize: "0.88rem", margin: 0 }}>
              Aucune actualité pour l&apos;instant — l&apos;ingestion automatique des actualités n&apos;est pas encore activée
              (cf. feuille de route, AGENTS.md).
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {articles.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, textDecoration: "none" }}
              >
                <div style={{ color: C.textDim, fontSize: "0.7rem", marginBottom: 6 }}>
                  {a.sourceName} · {new Date(a.publishedAt).toLocaleDateString("fr-FR")}
                  {a.company ? ` · ${a.company.ticker}` : ""}
                </div>
                <div style={{ color: C.text, fontSize: "0.95rem", fontWeight: 700, marginBottom: 4 }}>{a.title}</div>
                {a.summary && <div style={{ color: C.textDim, fontSize: "0.82rem" }}>{a.summary}</div>}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
