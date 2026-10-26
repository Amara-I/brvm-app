import Link from "next/link";
import { BRAND_NAME } from "@/lib/theme/brand";
import { getI18n } from "@/lib/i18n/get-i18n";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  const { t } = getI18n();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandCol}>
          <div className={styles.brand}>{BRAND_NAME}</div>
          <p className={styles.muted}>{t("chrome.footer.tagline")}</p>
        </div>
        <div>
          <p className={styles.colTitle}>{t("chrome.footer.product")}</p>
          <Link href="/screener" className={styles.link}>
            {t("chrome.footer.screener")}
          </Link>
          <Link href="/portefeuille" className={styles.link}>
            {t("chrome.footer.portfolio")}
          </Link>
          <Link href="/graphes" className={styles.link}>
            {t("chrome.footer.charts")}
          </Link>
          <Link href="/simulation" className={styles.link}>
            {t("chrome.footer.simulation")}
          </Link>
          <Link href="/societes-cotees" className={styles.link}>
            {t("chrome.footer.companies")}
          </Link>
          <Link href="/graphes" className={styles.link}>
            {t("chrome.footer.alerts")}
          </Link>
        </div>
        <div>
          <p className={styles.colTitle}>{t("chrome.footer.markets")}</p>
          <Link href="/marche" className={styles.link}>
            {t("chrome.footer.marketView")}
          </Link>
          <Link href="/actualites" className={styles.link}>
            {t("chrome.footer.news")}
          </Link>
          <Link href="/indices" className={styles.link}>
            {t("chrome.footer.indices")}
          </Link>
          <Link href="/calendrier-dividendes" className={styles.link}>
            {t("chrome.footer.dividends")}
          </Link>
        </div>
        <div>
          <p className={styles.colTitle}>{t("chrome.footer.resources")}</p>
          <Link href="/outils" className={styles.link}>
            {t("chrome.footer.tools")}
          </Link>
          <Link href="/education" className={styles.link}>
            {t("chrome.footer.education")}
          </Link>
          <Link href="/mentions-legales" className={styles.link}>
            {t("chrome.footer.legal")}
          </Link>
        </div>
        <div>
          <p className={styles.colTitle}>{t("chrome.footer.account")}</p>
          <Link href="/connexion" className={styles.link}>
            {t("chrome.footer.login")}
          </Link>
          <Link href="/inscription" className={styles.link}>
            {t("chrome.footer.register")}
          </Link>
          <Link href="/portefeuille" className={styles.link}>
            {t("chrome.footer.portfolio")}
          </Link>
        </div>
      </div>
      <div className={styles.bottom}>
        <span>
          © {new Date().getFullYear()} {BRAND_NAME}
        </span>
        <span className={styles.muted}>{t("chrome.footer.delayed")}</span>
      </div>
    </footer>
  );
}
