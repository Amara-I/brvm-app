import Link from "next/link";
import { BRAND_NAME } from "@/lib/theme/brand";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandCol}>
          <div className={styles.brand}>{BRAND_NAME}</div>
          <p className={styles.muted}>
            Analyse financière de la BRVM et des marchés africains — données réelles, signaux explicites.
          </p>
        </div>
        <div>
          <p className={styles.colTitle}>Produit</p>
          <Link href="/screener" className={styles.link}>
            Screener
          </Link>
          <Link href="/portefeuille" className={styles.link}>
            Portefeuille
          </Link>
          <Link href="/graphes" className={styles.link}>
            Graphiques
          </Link>
          <Link href="/simulation" className={styles.link}>
            Simulation
          </Link>
          <Link href="/societes-cotees" className={styles.link}>
            Sociétés cotées
          </Link>
          <Link href="/graphes" className={styles.link}>
            Alertes de seuil
          </Link>
        </div>
        <div>
          <p className={styles.colTitle}>Marchés</p>
          <Link href="/marche" className={styles.link}>
            Vue marché
          </Link>
          <Link href="/actualites" className={styles.link}>
            Actualités
          </Link>
          <span className={styles.soon}>
            Indices BRVM <em>BIENTÔT</em>
          </span>
          <Link href="/calendrier-dividendes" className={styles.link}>
            Calendrier dividendes
          </Link>
        </div>
        <div>
          <p className={styles.colTitle}>Ressources</p>
          <Link href="/outils" className={styles.link}>
            Outils
          </Link>
          <Link href="/education" className={styles.link}>
            Éducation
          </Link>
          <Link href="/mentions-legales" className={styles.link}>
            Mentions légales
          </Link>
        </div>
        <div>
          <p className={styles.colTitle}>Compte</p>
          <Link href="/connexion" className={styles.link}>
            Se connecter
          </Link>
          <Link href="/inscription" className={styles.link}>
            Créer un compte
          </Link>
          <Link href="/portefeuille" className={styles.link}>
            Portefeuille
          </Link>
        </div>
      </div>
      <div className={styles.bottom}>
        <span>
          © {new Date().getFullYear()} {BRAND_NAME}
        </span>
        <span className={styles.muted}>Cotations en différé · Sources BRVM / Sikafinance / Richbourse</span>
      </div>
    </footer>
  );
}
