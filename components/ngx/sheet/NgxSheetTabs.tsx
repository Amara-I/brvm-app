"use client";

// Onglets de la fiche NGX, mêmes clés et même rendu que la fiche BRVM :
// Vue d'ensemble · Analyse fondamentale · Analyse Graphique.
// Les panneaux sont rendus côté serveur et passés tels quels ; seul l'onglet actif est monté
// (le graphe ne se dessine pas dans un conteneur caché).

import { useEffect, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { trackFeature } from "@/components/analytics/track-client";
import { NGX_SHEET_TABS, normalizeNgxSheetTab, ngxSheetTabFromHash, type NgxSheetTabKey } from "@/lib/ui/company-sheet-tabs";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import styles from "@/components/actions/CompanySheet.module.css";

export default function NgxSheetTabs({
  ticker,
  panels,
}: {
  ticker: string;
  panels: Record<NgxSheetTabKey, ReactNode>;
}) {
  const { t } = useI18n();
  const [tab, setTab] = usePersistedState<string>(`ouestbourse:ngx-sheet:${ticker}:tab`, "overview");
  const active = normalizeNgxSheetTab(tab);

  useEffect(() => {
    if (tab !== active) setTab(active);
  }, [tab, active, setTab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromHash = ngxSheetTabFromHash(window.location.hash);
    const rawTab = params.get("tab");
    if (fromHash) setTab(fromHash);
    else if (rawTab) setTab(normalizeNgxSheetTab(rawTab));
  }, [setTab]);

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label={t("company.tabsAria")}>
        {NGX_SHEET_TABS.map((def) => (
          <button
            key={def.key}
            type="button"
            role="tab"
            id={`ngx-tab-${def.key}`}
            aria-selected={active === def.key}
            aria-controls={`ngx-tabpanel-${def.key}`}
            className={active === def.key ? styles.tabActive : styles.tab}
            data-testid={`ngx-tab-${def.key}`}
            onClick={() => {
              setTab(def.key);
              trackFeature("company_sheet", `ngx-tab:${def.key}`);
            }}
          >
            {t(`company.tabs.${def.key}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`ngx-tabpanel-${active}`} aria-labelledby={`ngx-tab-${active}`}>
        {panels[active]}
      </div>
    </>
  );
}
