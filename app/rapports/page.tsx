import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import PageHeader from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { companyHref } from "@/lib/markets/search";
export const dynamic = "force-dynamic";
export const metadata = { title: "Rapports d’entreprise — BRVM et NGX" };
export default async function ReportsPage({ searchParams }: { searchParams?: { exchange?: string; page?: string } }) {
  const exchange = searchParams?.exchange === "NGX" || searchParams?.exchange === "BRVM" ? searchParams.exchange : undefined;
  const raw = Number(searchParams?.page ?? 1); const page = Number.isSafeInteger(raw) && raw > 0 && raw <= 10000 ? raw : 1;
  const rows = await prisma.companyDocument.findMany({ where: { company: { exchange: exchange ?? { in: ["BRVM", "NGX"] } } },
    include: { company: { select: { ticker: true, name: true, exchange: true } } },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }], skip: (page - 1) * 50, take: 51 });
  const href = (p: number) => `/rapports?page=${p}${exchange ? `&exchange=${exchange}` : ""}`;
  return <AppHeader><div className="ob-page">
    <PageHeader kicker="BRVM · NGX" title="Rapports d’entreprise" lead="Documents et communiqués sourcés. La date de collecte n’est pas la date de publication ; un rapport disponible ne signifie pas que ses chiffres ont été validés." />
    <nav aria-label="Marché des rapports" style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
      <Link href="/rapports">Tous</Link><Link href="/rapports?exchange=BRVM">BRVM</Link><Link href="/rapports?exchange=NGX">NGX</Link><Link href="/actualites">Actualités</Link>
    </nav>
    {rows.length === 0 ? <p>N/D — aucun document catalogué pour ce périmètre.</p> : <div className="ob-news-list">{rows.slice(0, 50).map((r) => <article key={r.id} className="ob-news-card">
      <p className="ob-news-meta">{r.company.exchange} · <Link href={companyHref({ ticker: r.company.ticker, exchange: r.company.exchange as "BRVM" | "NGX" })}>{r.company.ticker}</Link> · {r.sourceName}</p>
      <h2 className="ob-news-title"><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title ?? r.filename ?? "Rapport — N/D"}</a></h2>
      <p>Publication : {r.publishedAt?.toISOString().slice(0, 10) ?? "N/D"} · Exercice : {r.periodLabel ?? "N/D"}</p>
      <small>Collecté le {r.createdAt.toISOString().slice(0, 10)} · Les liens peuvent mener à la page officielle du rapport ou au PDF.</small>
    </article>)}</div>}
    <nav aria-label="Pagination des rapports" style={{ display: "flex", gap: 20, marginTop: 20 }}>{page > 1 && <Link href={href(page - 1)}>Précédent</Link>}{rows.length > 50 && <Link href={href(page + 1)}>Suivant</Link>}</nav>
  </div></AppHeader>;
}
