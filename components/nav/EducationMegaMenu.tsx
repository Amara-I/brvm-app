"use client";

// Méga-menu Éducation : clic sur le libellé ouvre/ferme le panneau.
// "Voir tout" (et les liens internes) mènent au hub /education.

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { C } from "@/lib/theme/colors";
import {
  EDUCATION_CATEGORIES,
  EDUCATION_TERMS,
  countTermsByCategory,
  themesByCategory,
} from "@/lib/education/catalog";
import { localizeCategory, localizeTheme } from "@/lib/education/localize";
import MegaMenuTrigger from "./MegaMenuTrigger";
import styles from "./MegaMenu.module.css";
import { useMegaMenu } from "./useMegaMenu";

const cssVars = {
  "--mm-border": C.border,
  "--mm-panelAlt": C.panel,
  "--mm-green": C.green,
  "--mm-textDim": C.textDim,
  "--mm-text": C.text,
  "--mm-bg": C.bg,
  "--mm-gold": C.gold,
} as React.CSSProperties;

export default function EducationMegaMenu({
  variant = "inline",
  onNavigate,
}: {
  variant?: "inline" | "sidebar";
  onNavigate?: () => void;
}) {
  const { t, locale } = useI18n();
  const { open, close, toggle, wrapperRef, triggerRef, panelId } = useMegaMenu();
  const total = EDUCATION_TERMS.length;
  const isSidebar = variant === "sidebar";
  const wrapperClass = isSidebar ? `${styles.wrapper} ${styles.wrapperSidebar}` : styles.wrapper;
  const triggerClass = isSidebar ? `${styles.trigger} ${styles.triggerSidebar}` : styles.trigger;
  const panelClass = isSidebar ? `${styles.panel} ${styles.panelSidebar}` : styles.panel;

  function closeMenu() {
    close();
    onNavigate?.();
  }

  return (
    <div className={wrapperClass} ref={wrapperRef} style={cssVars}>
      <MegaMenuTrigger
        label={t("auth.mega.education")}
        open={open}
        panelId={panelId}
        triggerRef={triggerRef}
        onToggle={toggle}
        className={triggerClass}
        analyticsFeature="education"
        expandCaret={isSidebar}
      />

      {open && (
        <div id={panelId} role="region" aria-label={t("auth.mega.educationAria")} className={panelClass}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>{t("auth.mega.educationPaths", { count: total })}</span>
            <Link
              href="/education"
              className={styles.headerAll}
              onClick={closeMenu}
              data-analytics-feature="education"
              data-analytics-action="mega_menu_all"
            >
              {t("common.seeAll")} →
            </Link>
          </div>
          <div className={styles.panelGrid}>
            {EDUCATION_CATEGORIES.map((raw) => {
              const cat = localizeCategory(raw, locale);
              const themes = themesByCategory(raw.slug).map((theme) => localizeTheme(theme, locale));
              return (
                <div key={raw.slug} className={styles.sectorCol}>
                  <Link
                    href={`/education#${raw.slug}`}
                    className={styles.sectorHeading}
                    onClick={closeMenu}
                    style={{ textDecoration: "none", display: "block" }}
                    data-analytics-feature="education"
                    data-analytics-action="mega_menu_category"
                  >
                    {cat.title}{" "}
                    <span className={styles.sectorCount}>({countTermsByCategory(raw.slug)})</span>
                  </Link>
                  {themes.map((theme) => (
                    <Link
                      key={theme.slug}
                      href={`/education/${theme.slug}`}
                      className={styles.companyRow}
                      onClick={closeMenu}
                      data-analytics-feature="education"
                      data-analytics-action="mega_menu"
                    >
                      <span className={styles.companyName} style={{ margin: 0 }}>
                        {theme.title}
                      </span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
