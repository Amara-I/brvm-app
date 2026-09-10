// Page "Sociétés cotées" — présentation par catégorie (secteur) + contexte.
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import AnalysisRecap from "@/components/analysis/AnalysisRecap";
import { C } from "@/lib/theme/colors";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { calcMetrics } from "@/lib/calc/calc-metrics";
import { fundamentalRecapLines, truncateSummary } from "@/lib/calc/analysis-recap";
import styles from "@/components/societes/SocietesCotees.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sociétés cotées — OuestBourse",
  description:
    "Liste des sociétés cotées à la BRVM, classées par secteur, avec cours, capitalisation et signaux d'analyse.",
};

/** Courtes présentations factuelles des secteurs BRVM (pas de chiffres inventés). */
const SECTOR_CONTEXT: Record<string, string> = {
  Banques:
    "Établissements bancaires de l'UEMOA cotés à la BRVM : activité de crédit, collecte de dépôts et services financiers. Souvent suivis pour le rendement du dividende et la solidité du bilan.",
  "Conso. Base":
    "Biens de consommation courante (alimentaire, boissons, produits d'hygiène). Demande relativement stable, titres souvent regardés pour la récurrence des revenus.",
  "Conso. Discrétionnaire":
    "Biens et services non essentiels (distribution, équipements, loisirs). Plus sensibles au cycle économique et au pouvoir d'achat des ménages.",
  Divertissement:
    "Activités de médias, loisirs et divertissement cotées sur la place. Univers restreint à la BRVM — chaque titre doit être lu individuellement.",
  Énergie:
    "Producteurs et distributeurs d'énergie (hydrocarbures, gaz, services associés). Sensibles aux prix des matières et à la régulation nationale.",
  Industrie:
    "Industries manufacturières et transformation. Performance liée à l'investissement productif, aux coûts d'intrants et à la demande régionale.",
  "Services Publics":
    "Services d'intérêt général (eau, électricité, infrastructures). Profil souvent défensif, avec une composante réglementaire importante.",
  Télécoms:
    "Opérateurs de télécommunications. Forte présence dans les indices BRVM, suivis pour la croissance des abonnés, le cash-flow et la politique de dividende.",
  Autres:
    "Sociétés dont le secteur officiel ne rentre pas dans les catégories ci-dessus, ou classification encore partielle en base.",
};

function sectorBlurb(sector: string): string {
  return (
    SECTOR_CONTEXT[sector] ??
    `Sociétés classées dans le secteur « ${sector} » selon la nomenclature retenue en base (sources BRVM / Richbourse).`
  );
}

function lastPrice(prices: Record<number, number>, years: number[]): number | null {
  for (let i = years.length - 1; i >= 0; i--) {
    const p = prices[years[i]!];
    if (p != null && p > 0) return p;
  }
  return null;
}

export default async function SocietesCoteesPage() {
  const dataset = await getCompaniesFullDataset();
  const { companies, years } = dataset;
  const yearSpan =
    years.length >= 2 ? `${years[0]} → ${years[years.length - 1]}` : years[0] != null ? String(years[0]) : "N/D";

  const countries = new Set(companies.map((c) => c.country));

  const bySector = new Map<string, typeof companies>();
  for (const co of companies) {
    const list = bySector.get(co.sector) ?? [];
    list.push(co);
    bySector.set(co.sector, list);
  }

  const sectors = [...bySector.entries()]
    .map(([sector, list]) => ({
      sector,
      companies: [...list].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }))
    .sort((a, b) => a.sector.localeCompare(b.sector, "fr"));

  const sectorSlug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

  return (
    <AppHeader>
      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>La cote BRVM</p>
          <h1 className={styles.title}>Sociétés cotées</h1>
          <p className={styles.lead}>
            Ensemble des émetteurs suivis sur la <strong style={{ color: C.text }}>BRVM</strong> (Bourse
            Régionale des Valeurs Mobilières, zone UEMOA). Les sociétés sont regroupées par{" "}
            <strong style={{ color: C.text }}>catégorie sectorielle</strong> pour faciliter la comparaison
            entre pairs. Chaque fiche détaille le signal d&apos;analyse, l&apos;historique et les
            projections.
          </p>
          <div className={styles.metaStrip}>
            <span className={styles.metaChip}>{companies.length} émetteurs</span>
            <span className={styles.metaChip}>{sectors.length} secteurs</span>
            <span className={styles.metaChip}>{countries.size} pays</span>
            <span className={styles.metaChip}>Historique {yearSpan}</span>
          </div>
        </header>

        <nav className={styles.toc} aria-label="Catégories sectorielles">
          <div className={styles.tocLabel}>Aller à une catégorie</div>
          {sectors.map(({ sector, companies: list }) => (
            <a key={sector} href={`#secteur-${sectorSlug(sector)}`} className={styles.tocLink}>
              {sector} ({list.length})
            </a>
          ))}
        </nav>

        {sectors.map(({ sector, companies: list }) => {
          const mktSum = list.reduce((a, c) => a + (c.mktcap > 0 ? c.mktcap : 0), 0);
          const withCap = list.filter((c) => c.mktcap > 0).length;
          return (
            <section
              key={sector}
              id={`secteur-${sectorSlug(sector)}`}
              className={styles.section}
              aria-labelledby={`h-${sectorSlug(sector)}`}
            >
              <div className={styles.sectionHead}>
                <h2 id={`h-${sectorSlug(sector)}`} className={styles.sectionTitle}>
                  {sector} <span className={styles.sectionCount}>({list.length})</span>
                </h2>
                <div className={styles.sectionStats}>
                  Cap. renseignée :{" "}
                  {mktSum > 0
                    ? `${mktSum.toLocaleString("fr-FR")} Mds FCFA (${withCap}/${list.length})`
                    : "N/D"}
                </div>
              </div>
              <p className={styles.sectionBlurb}>{sectorBlurb(sector)}</p>

              <div className={styles.grid}>
                {list.map((co) => {
                  const price = lastPrice(co.prices, years);
                  const m = calcMetrics({
                    years,
                    prices: co.prices,
                    dividends: co.dividends,
                    per: co.per,
                    mktcap: co.mktcap,
                    sector: co.sector,
                  });
                  return (
                    <article key={co.ticker} id={co.ticker} className={styles.card}>
                      <Link href={`/actions/${co.ticker}`} className={styles.cardMain}>
                        <div className={styles.cardTop}>
                          <span className={styles.logo} aria-hidden="true">
                            {co.ticker.slice(0, 2)}
                          </span>
                          <div className={styles.cardIdentity}>
                            <span className={styles.ticker}>{co.ticker}</span>
                            <span className={styles.name}>{co.name}</span>
                            <span className={styles.country}>
                              {co.countryFlag} {co.country}
                            </span>
                          </div>
                        </div>
                        <div className={styles.cardMetrics}>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Cours</span>
                            <span className={styles.metricValue}>
                              {price != null ? `${price.toLocaleString("fr-FR")} FCFA` : "N/D"}
                            </span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Cap. boursière</span>
                            <span className={styles.metricValue}>
                              {co.mktcap > 0 ? `${co.mktcap.toLocaleString("fr-FR")} Mds` : "N/D"}
                            </span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Rend. div.</span>
                            <span className={styles.metricValue} style={{ color: C.teal }}>
                              {m.dividendYieldPercent}%
                            </span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Score</span>
                            <span className={styles.metricValue}>{m.score}/100</span>
                          </div>
                        </div>
                        <div className={styles.cardFooter}>
                          <span
                            className={styles.pill}
                            style={{
                              color: m.signal.color,
                              background: `color-mix(in srgb, ${m.signal.color} 18%, transparent)`,
                            }}
                          >
                            {m.signal.label}
                          </span>
                          <span className={styles.more}>Fiche →</span>
                        </div>
                      </Link>
                      <AnalysisRecap
                        kind="fundamental"
                        signalLabel={m.signal.label}
                        signalColor={m.signal.color}
                        score={m.fundamentalScore}
                        confidence={m.confidence}
                        summary={truncateSummary(m.signalSummary)}
                        lines={fundamentalRecapLines(m, co.per)}
                        href={`/actions/${co.ticker}`}
                        hrefLabel="Fiche & analyse complète →"
                      />
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        <p className={styles.note}>
          Sources : données canoniques BRVM / Sikafinance / Richbourse réconciliées en base. Les
          capitalisations ou PER absents s&apos;affichent « N/D ». Analyse informative uniquement —
          ne constitue pas un conseil en investissement.{" "}
          <Link href="/mentions-legales" style={{ color: C.textDim }}>
            Mentions légales
          </Link>
        </p>
      </main>
      <SiteFooter />
    </AppHeader>
  );
}
