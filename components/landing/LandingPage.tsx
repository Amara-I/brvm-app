// Landing page — contenu aligné sur les modules réels de la plateforme OuestBourse.
// Chiffres exclusivement issus des données BRVM (jamais inventés).

import Link from "next/link";
import type { MarketSummaryStats } from "@/lib/calc/market-summary-stats";
import type { CalcMetricsResult } from "@/lib/calc/calc-metrics";
import type { CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import { BRAND_NAME } from "@/lib/theme/brand";
import styles from "./Landing.module.css";

export interface LandingPageProps {
  stats: MarketSummaryStats;
  topCompanies: Array<{ co: CompanyFullDataset; metrics: CalcMetricsResult }>;
  /** Nombre de secteurs présents en base (données réelles). */
  sectorsCount: number;
  /** Nombre de termes du lexique Éducation. */
  educationTermsCount: number;
}

function formatMdsFcfa(value: number): string {
  return `${value.toLocaleString("fr-FR")} Mds FCFA`;
}

function formatSignal(metrics: CalcMetricsResult): string {
  return metrics.signal?.label || "N/D";
}

export default function LandingPage({
  stats,
  topCompanies,
  sectorsCount,
  educationTermsCount,
}: LandingPageProps) {
  const yearsSpan =
    stats.firstYear && stats.lastYear ? stats.lastYear - stats.firstYear + 1 : null;
  const horizonLabel =
    stats.firstYear && stats.lastYear
      ? `${stats.firstYear} → ${stats.lastYear}`
      : "N/D";

  const modules = [
    {
      t: "Marché",
      d: "Vue d’ensemble des positions BRVM, scores, signaux ACHAT / CONSERVER / VENDRE et accès rapide aux fiches.",
      href: "/marche",
    },
    {
      t: "Screener",
      d: "Filtres rentabilité, dividendes, croissance, valorisation et solidité — mêmes calculs que le dashboard.",
      href: "/screener",
    },
    {
      t: "Graphes",
      d: "Chandeliers, SMA / RSI / MACD, Fibonacci, mesure %, tracés déplaçables et analyses sauvegardées (compte).",
      href: "/graphes",
    },
    {
      t: "Fiches sociétés",
      d: "Cours, historiques, indicateurs, dividendes, projection et comparaison — une fiche par ticker.",
      href: "/societes-cotees",
    },
    {
      t: "Portefeuille",
      d: "Positions, valeur de marché, plus-value latente, YTD et répartition sectorielle pour les comptes connectés.",
      href: "/portefeuille",
    },
    {
      t: "Éducation",
      d: `Lexique et guides BRVM (${educationTermsCount} termes) pour comprendre analyses, ratios et outils de la plateforme.`,
      href: "/education",
    },
    {
      t: "Dividendes",
      d: "Calendrier des dividendes pour suivre les échéances des sociétés cotées.",
      href: "/calendrier-dividendes",
    },
    {
      t: "Outils",
      d: "Export Excel du marché et pistes de veille produit — sans chiffres inventés.",
      href: "/outils",
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.badge}>
              <span className={styles.badgeDot} />
              Plateforme d&apos;analyse BRVM · {BRAND_NAME}
            </span>

            <h1 className={styles.h1}>
              Marché, graphes et signaux
              <br />
              pour la cote BRVM.
            </h1>
            <p className={styles.tagline}>
              Screener · Fiches · Graphiques · Portefeuille · Éducation
            </p>
            <p className={styles.paragraph}>
              {BRAND_NAME} regroupe les {stats.companiesCount} sociétés suivies, des historiques sourcés
              (BRVM, Sikafinance, Richbourse), des signaux expliqués et des outils d&apos;analyse graphique —
              le même moteur de calcul sur tout le site. Destiné à l&apos;information, pas un conseil en
              investissement.
            </p>

            <div className={styles.ctaRow}>
              <Link href="/marche" className={styles.ctaPrimary}>
                Ouvrir le marché <span aria-hidden="true">→</span>
              </Link>
              <Link href="/graphes" className={styles.ctaSecondary}>
                Voir les graphes
              </Link>
            </div>

            <div className={styles.featureRow}>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon} aria-hidden="true">
                  📊
                </span>
                <span className={styles.featureText}>
                  <strong>Marché & screener</strong>
                  Signaux multi-horizons et filtres sur les {stats.companiesCount} titres
                </span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon} aria-hidden="true">
                  📈
                </span>
                <span className={styles.featureText}>
                  <strong>Graphes avancés</strong>
                  Indicateurs, Fibonacci, mesure % et sauvegarde d&apos;analyse
                </span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon} aria-hidden="true">
                  💼
                </span>
                <span className={styles.featureText}>
                  <strong>Portefeuille</strong>
                  Suivi des positions pour les comptes actifs
                </span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon} aria-hidden="true">
                  📚
                </span>
                <span className={styles.featureText}>
                  <strong>Éducation</strong>
                  {educationTermsCount} termes pour lire la BRVM et la plateforme
                </span>
              </div>
            </div>
          </div>

          <div className={styles.heroRight}>
            <div className={`${styles.card} ${styles.cardPortfolio}`}>
              <div className={styles.cardLabel}>Marché BRVM · Données réelles</div>
              <div className={styles.cardValue}>{formatMdsFcfa(stats.totalMarketCapBnFcfa)}</div>
              <span className={`${styles.cardChip} ${styles.chipGreen}`}>
                {stats.avgPerf5Percent !== null
                  ? `${stats.avgPerf5Percent >= 0 ? "+" : ""}${stats.avgPerf5Percent.toFixed(1)}% · 5 ans`
                  : "Perf. 5 ans N/D"}
              </span>
              <span className={`${styles.cardChip} ${styles.chipAccent}`}>
                {stats.companiesCount} sociétés · {sectorsCount} secteurs
              </span>
              <span className={`${styles.cardChip} ${styles.chipAccent}`}>
                {stats.buySignalsCount} signaux ≥ 65/100
              </span>
            </div>

            <div className={`${styles.card} ${styles.cardStock}`}>
              <div className={styles.cardLabel}>Meilleurs scores du marché</div>
              {topCompanies.length === 0 ? (
                <div className={styles.stockRow}>
                  <span className={styles.stockTicker}>N/D</span>
                </div>
              ) : (
                topCompanies.map(({ co, metrics }) => (
                  <Link
                    key={co.ticker}
                    href={`/actions/${co.ticker}`}
                    className={styles.stockRow}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <span className={styles.stockTicker}>
                      {co.countryFlag} {co.ticker}
                    </span>
                    <span
                      className={
                        metrics.perf5Percent !== "N/D" && parseFloat(metrics.perf5Percent) >= 0
                          ? styles.stockChangeUp
                          : styles.stockChangeDown
                      }
                    >
                      {formatSignal(metrics)}
                      {metrics.perf5Percent !== "N/D"
                        ? ` · ${parseFloat(metrics.perf5Percent) >= 0 ? "+" : ""}${metrics.perf5Percent}%`
                        : ""}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statsInner}>
            <div className={styles.statItem}>
              <span className={styles.statIcon} aria-hidden="true">
                🏢
              </span>
              <div>
                <div className={styles.statValue}>{stats.companiesCount}</div>
                <div className={styles.statLabel}>Sociétés cotées suivies</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon} aria-hidden="true">
                📅
              </span>
              <div>
                <div className={styles.statValue}>{yearsSpan !== null ? `${yearsSpan}` : "N/D"}</div>
                <div className={styles.statLabel}>Années d&apos;historique ({horizonLabel})</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon} aria-hidden="true">
                🗂️
              </span>
              <div>
                <div className={styles.statValue}>{sectorsCount}</div>
                <div className={styles.statLabel}>Secteurs en base</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon} aria-hidden="true">
                📚
              </span>
              <div>
                <div className={styles.statValue}>{educationTermsCount}</div>
                <div className={styles.statLabel}>Termes du lexique Éducation</div>
              </div>
            </div>
            <div className={styles.statNote}>
              🔒 Sources : BRVM officiel · Sikafinance · Richbourse · Rend. div. moyen :{" "}
              {stats.avgDividendYieldPercent !== null
                ? `${stats.avgDividendYieldPercent.toFixed(1).replace(".", ",")} %`
                : "N/D"}
            </div>
          </div>
        </div>
      </section>

      <div className={styles.belowHero}>
        <section className={styles.section}>
          <p className={styles.sectionEyebrow}>Pourquoi {BRAND_NAME}</p>
          <h2 className={styles.sectionTitle}>
            Une seule plateforme pour lire, filtrer et tracer la BRVM.
          </h2>
          <p className={styles.sectionLead}>
            Au lieu de jongler entre sites de cours, historiques et analyses, vous ouvrez le marché, un graphe
            ou une fiche société — avec source et horodatage, et des données manquantes affichées « N/D ».
          </p>
          <div className={styles.grid2}>
            <div className={styles.trustBlock}>
              <h3>Ce que la plateforme évite</h3>
              <p>
                Données éparpillées, signaux sans explication, graphiques sans outils d&apos;analyse, et chiffres
                marketing non vérifiables.
              </p>
            </div>
            <div className={styles.trustBlock}>
              <h3>Ce que vous utilisez ici</h3>
              <p>
                {stats.companiesCount} titres, {sectorsCount} secteurs, historique {horizonLabel}, screener,
                graphes (indicateurs + Fibonacci + mesure), portefeuille connecté et lexique Éducation.
              </p>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionAlt}`}>
          <p className={styles.sectionEyebrow}>Modules de la plateforme</p>
          <h2 className={styles.sectionTitle}>Tout ce que vous retrouvez dans le menu.</h2>
          <p className={styles.sectionLead}>
            Chaque bloc ci-dessous correspond à une page réelle de {BRAND_NAME} — pas une promesse hors produit.
          </p>
          <div className={styles.grid4}>
            {modules.map((f) => (
              <article key={f.t} className={styles.featureCard}>
                <h3>
                  <Link href={f.href} className={styles.featureTitleLink}>
                    {f.t}
                  </Link>
                </h3>
                <p>{f.d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <p className={styles.sectionEyebrow}>Données & analyse</p>
          <h2 className={styles.sectionTitle}>De la source officielle à votre décision.</h2>
          <p className={styles.sectionLead}>
            Collecte multi-source, valeur canonique, puis scores / projections / export — le même socle que
            Marché, Screener et Excel.
          </p>
          <div className={styles.grid3}>
            {[
              {
                n: "1",
                t: "Collecte",
                d: "BRVM.org en priorité, puis Sikafinance et Richbourse — connecteurs isolés et rate-limités.",
              },
              {
                n: "2",
                t: "Réconciliation",
                d: "Écarts > 2 % journalisés ; une seule cotation canonique affichée sous chaque société.",
              },
              {
                n: "3",
                t: "Lecture",
                d: "Signaux expliqués, fiches, graphes techniques et export Excel sur les données canoniques.",
              },
            ].map((s) => (
              <div key={s.n} className={styles.cycleStep}>
                <span className={styles.cycleNum}>{s.n}</span>
                <div>
                  <h3 style={{ margin: "0 0 6px", fontSize: "0.95rem" }}>{s.t}</h3>
                  <p style={{ margin: 0, color: "var(--c-textdim)", fontSize: "0.82rem", lineHeight: 1.55 }}>
                    {s.d}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionAlt}`}>
          <div className={styles.ctaBand}>
            <div>
              <h2 className={styles.ctaBandTitle}>Explorez la plateforme maintenant</h2>
              <p className={styles.ctaBandText}>
                {stats.companiesCount} sociétés · {stats.buySignalsCount} titres à score élevé · graphes et
                screener prêts à l&apos;emploi
                {stats.avgDividendYieldPercent !== null
                  ? ` · rend. div. moyen ${stats.avgDividendYieldPercent.toFixed(1).replace(".", ",")} %`
                  : ""}
                .
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/marche" className={styles.btnGold}>
                Marché
              </Link>
              <Link href="/screener" className={styles.btnOutline}>
                Screener
              </Link>
              <Link href="/graphes" className={styles.btnOutline}>
                Graphes
              </Link>
              <Link href="/inscription" className={styles.btnOutline}>
                Créer un compte
              </Link>
            </div>
          </div>
        </section>

        <footer className={styles.landingFooter}>
          <div className={styles.footerInner}>
            <div>
              <div className={styles.footerBrand}>{BRAND_NAME}</div>
              <p className={styles.footerMuted}>
                Analyse de la BRVM pour l&apos;Afrique de l&apos;Ouest. Contenu informatif uniquement — pas un
                conseil en investissement personnalisé.
              </p>
            </div>
            <div>
              <p className={styles.footerColTitle}>Analyser</p>
              <Link href="/marche" className={styles.footerLink}>
                Marché
              </Link>
              <Link href="/screener" className={styles.footerLink}>
                Screener
              </Link>
              <Link href="/graphes" className={styles.footerLink}>
                Graphes
              </Link>
              <Link href="/societes-cotees" className={styles.footerLink}>
                Sociétés cotées
              </Link>
            </div>
            <div>
              <p className={styles.footerColTitle}>Suivre</p>
              <Link href="/portefeuille" className={styles.footerLink}>
                Portefeuille
              </Link>
              <Link href="/calendrier-dividendes" className={styles.footerLink}>
                Dividendes
              </Link>
              <Link href="/actualites" className={styles.footerLink}>
                Actualités
              </Link>
              <Link href="/education" className={styles.footerLink}>
                Éducation
              </Link>
            </div>
            <div>
              <p className={styles.footerColTitle}>Compte & légal</p>
              <Link href="/connexion" className={styles.footerLink}>
                Connexion
              </Link>
              <Link href="/inscription" className={styles.footerLink}>
                Inscription
              </Link>
              <Link href="/outils" className={styles.footerLink}>
                Outils
              </Link>
              <Link href="/mentions-legales" className={styles.footerLink}>
                Mentions légales
              </Link>
            </div>
          </div>
          <p className={styles.footerCopy}>
            © {new Date().getFullYear()} {BRAND_NAME} · Sources : BRVM officiel · Sikafinance · Richbourse
          </p>
        </footer>
      </div>
    </div>
  );
}
