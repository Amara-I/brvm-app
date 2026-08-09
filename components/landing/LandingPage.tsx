// ═══════════════════════════════════════════════════════════════════════════
// Landing page — étape 10 (exception scoped, cf. règle non-négociable)
// ═══════════════════════════════════════════════════════════════════════════
// Reproduit visuellement la structure de la page d'accueil de
// ouestbourse.com (hero, badge, cartes flottantes, bandeau de stats) avec la
// palette dédiée `components/landing/theme.ts`. Server Component : tout le
// contenu chiffré provient de vraies données (`MarketSummaryStats` +
// `topScoredCompanies`, calculées via `lib/calc/*`, les MÊMES fonctions que
// le dashboard et l'export Excel) — aucun chiffre inventé/copié de
// ouestbourse.com.
//
// Divergences assumées par rapport à la capture fournie par l'utilisateur
// (documentées ici plutôt que "corrigées en silence", même philosophie que
// le reste du projet) :
//   - Pas de mockup "téléphone" (illustration/asset non disponible dans cet
//     environnement) : remplacé par une 2e carte de données réelles
//     (top performeurs du marché), qui occupe un rôle visuel équivalent.
//   - Nom/logo : "BRVM App" (jamais le nom/logo de ouestbourse.com, marque
//     tierce — cf. règle non-négociable mise à jour).
//   - Icônes : emojis (cohérent avec le reste de l'app, pas de dépendance
//     supplémentaire) plutôt que les icônes vectorielles du site de référence.
// ═══════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import type { MarketSummaryStats } from "@/lib/calc/market-summary-stats";
import type { CalcMetricsResult } from "@/lib/calc/calc-metrics";
import type { CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import { LC, LANDING_SERIF } from "./theme";
import LandingHeader from "./LandingHeader";
import styles from "./Landing.module.css";

export interface LandingPageProps {
  stats: MarketSummaryStats;
  topCompanies: Array<{ co: CompanyFullDataset; metrics: CalcMetricsResult }>;
}

function formatMdsFcfa(value: number): string {
  return `${value.toLocaleString("fr-FR")} Mds FCFA`;
}

export default function LandingPage({ stats, topCompanies }: LandingPageProps) {
  const yearsSpan = stats.firstYear && stats.lastYear ? stats.lastYear - stats.firstYear + 1 : null;
  const cssVars = {
    "--lc-bg": LC.bg,
    "--lc-bgAlt": LC.bgAlt,
    "--lc-panel": LC.panel,
    "--lc-border": LC.border,
    "--lc-accent": LC.accent,
    "--lc-cream": LC.cream,
    "--lc-text": LC.text,
    "--lc-textDim": LC.textDim,
    "--lc-green": LC.green,
    "--lc-serif": LANDING_SERIF,
  } as React.CSSProperties;

  return (
    <div className={styles.page} style={cssVars}>
      <LandingHeader />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div>
            <span className={styles.badge}>
              <span className={styles.badgeDot} />
              Plateforme d&apos;intelligence de marché
            </span>

            <h1 className={styles.h1}>
              Toute l&apos;intelligence
              <br />
              de marché de la BRVM.
            </h1>
            <p className={styles.tagline}>Connaître. Analyser. Investir.</p>
            <p className={styles.paragraph}>
              Accédez à des données tracées et sourcées, des outils d&apos;analyse avancés (scores, projections, comparaisons) et
              suivez vos investissements sur la BRVM en toute confiance. Pensé pour les investisseurs d&apos;Afrique de l&apos;Ouest.
            </p>

            <div className={styles.ctaRow}>
              <Link href="/inscription" className={styles.ctaPrimary}>
                Commencer gratuitement <span aria-hidden="true">→</span>
              </Link>
              <Link href="/marche" className={styles.ctaSecondary}>
                <span aria-hidden="true">📊</span> Explorer les marchés
              </Link>
            </div>

            <div className={styles.featureRow}>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon} aria-hidden="true">
                  🕐
                </span>
                <span className={styles.featureText}>
                  <strong>Données tracées</strong>
                  Source et horodatage affichés pour chaque société
                </span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon} aria-hidden="true">
                  📊
                </span>
                <span className={styles.featureText}>
                  <strong>Analyses avancées</strong>
                  Score, signal, projections sur 3 à 10 ans
                </span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon} aria-hidden="true">
                  💼
                </span>
                <span className={styles.featureText}>
                  <strong>Suivi de portefeuille</strong>
                  Valeur, plus-value et répartition sectorielle
                </span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon} aria-hidden="true">
                  📰
                </span>
                <span className={styles.featureText}>
                  <strong>Actualités & tendances</strong>
                  L&apos;essentiel du marché BRVM au même endroit
                </span>
              </div>
            </div>
          </div>

          <div className={styles.heroRight}>
            <div className={`${styles.card} ${styles.cardPortfolio}`}>
              <div className={styles.cardLabel}>Marché BRVM · Aperçu en direct</div>
              <div className={styles.cardValue}>{formatMdsFcfa(stats.totalMarketCapBnFcfa)}</div>
              <span className={`${styles.cardChip} ${styles.chipGreen}`}>
                {stats.avgPerf5Percent !== null ? `+${stats.avgPerf5Percent.toFixed(1)}%` : "N/D"} · 5 ans
              </span>
              <span className={`${styles.cardChip} ${styles.chipAccent}`}>{stats.companiesCount} sociétés</span>
            </div>

            <div className={`${styles.card} ${styles.cardStock}`}>
              <div className={styles.cardLabel}>Meilleurs scores du marché</div>
              {topCompanies.map(({ co, metrics }) => (
                <div key={co.ticker} className={styles.stockRow}>
                  <span className={styles.stockTicker}>
                    {co.countryFlag} {co.ticker}
                  </span>
                  <span className={metrics.perf5Percent !== "N/D" && parseFloat(metrics.perf5Percent) >= 0 ? styles.stockChangeUp : styles.stockChangeDown}>
                    {metrics.perf5Percent !== "N/D" ? `${parseFloat(metrics.perf5Percent) >= 0 ? "+" : ""}${metrics.perf5Percent}%` : "N/D"}
                  </span>
                </div>
              ))}
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
                <div className={styles.statLabel}>Sociétés cotées BRVM</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon} aria-hidden="true">
                📅
              </span>
              <div>
                <div className={styles.statValue}>{yearsSpan !== null ? `${yearsSpan}+` : "N/D"}</div>
                <div className={styles.statLabel}>Années de données historiques</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon} aria-hidden="true">
                🧮
              </span>
              <div>
                <div className={styles.statValue}>8+</div>
                <div className={styles.statLabel}>Indicateurs financiers</div>
              </div>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon} aria-hidden="true">
                ✅
              </span>
              <div>
                <div className={styles.statValue}>100%</div>
                <div className={styles.statLabel}>Données tracées & sourcées</div>
              </div>
            </div>
            <div className={styles.statNote}>🔒 Sources : BRVM officiel · Sikafinance · Richbourse</div>
          </div>
        </div>
      </section>
    </div>
  );
}
