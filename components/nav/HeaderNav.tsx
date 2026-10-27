"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { C } from "@/lib/theme/colors";
import type { SectorGroup } from "@/lib/calc/market-summary-stats";
import type { AfricanExchange } from "@/lib/markets/african-exchanges";
import {
  comingSoonExchanges,
  comingSoonMarketHref,
  isBrvmNavPath,
  isComingSoonMarketNavPath,
  isComingSoonMarketSectionOpen,
  isSecondaryMarketPath,
  liveSecondaryExchanges,
  marketIndicesHref,
} from "@/lib/markets/nav-structure";
import CompanyMegaMenu from "./CompanyMegaMenu";
import EducationMegaMenu from "./EducationMegaMenu";
import type { HeaderSearchItem } from "@/components/nav/HeaderSearch";
import { featureFromPath } from "@/lib/analytics/features";
import { ExpandChevronMark } from "@/components/ui/ExpandChevron";
import styles from "./HeaderNav.module.css";
import { useI18n } from "@/components/i18n/I18nProvider";

export interface HeaderNavUser {
  name: string | null | undefined;
  email: string | null | undefined;
  isAdmin?: boolean;
  emailVerified?: boolean;
}

const cssVars = {
  "--hn-text": C.text,
  "--hn-green": C.green,
  "--hn-gold": C.gold,
  "--hn-panel": C.panel,
  "--hn-panelAlt": C.selectedBg,
  "--hn-border": C.border,
  "--hn-bg": C.bg,
  "--hn-textDim": C.textDim,
} as React.CSSProperties;

function NavLink({
  href,
  label,
  active,
  onClick,
  sidebar,
  analyticsFeature,
  analyticsAction,
  skipAnalytics,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
  sidebar?: boolean;
  analyticsFeature?: string;
  analyticsAction?: string;
  skipAnalytics?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${styles.navLink} ${sidebar ? styles.navLinkSidebar : ""} ${active ? styles.navLinkActive : ""}`}
      onClick={onClick}
      data-analytics-feature={skipAnalytics ? undefined : analyticsFeature ?? featureFromPath(href)}
      data-analytics-action={skipAnalytics ? undefined : analyticsAction ?? "nav"}
    >
      {label}
    </Link>
  );
}

/** Accordion marché — même déclencheur / chevron que BRVM. */
function MarketNavGroup({
  label,
  panelId,
  open,
  onToggle,
  active,
  live,
  badge,
  pagesLabel,
  children,
}: {
  label: string;
  panelId: string;
  open: boolean;
  onToggle: () => void;
  active: boolean;
  live?: boolean;
  badge?: string;
  pagesLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.marketGroup}>
      <button
        type="button"
        className={`${styles.marketTrigger} ${active ? styles.marketTriggerActive : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className={styles.marketTriggerMain}>
          {live ? <span className={styles.liveDot} aria-hidden="true" /> : null}
          {label}
        </span>
        <span className={styles.marketTriggerMeta}>
          {badge ? <span className={styles.soonBadge}>{badge}</span> : null}
          <ExpandChevronMark expanded={open} />
        </span>
      </button>
      {open ? (
        <div id={panelId} className={styles.navNested} role="group" aria-label={pagesLabel}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default function HeaderNav({
  sectorGroups,
  totalCompanies,
  layout = "sidebar",
  onNavigate,
  user,
}: {
  sectorGroups: SectorGroup[];
  totalCompanies: number;
  searchCompanies: HeaderSearchItem[];
  user: HeaderNavUser | null;
  layout?: "sidebar";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);
  const sidebar = layout === "sidebar";
  const close = onNavigate;
  const brvmActive = isBrvmNavPath(pathname);
  const [brvmOpen, setBrvmOpen] = useState(true);
  const [soonToggle, setSoonToggle] = useState<{
    path: string | null;
    open: Partial<Record<AfricanExchange["code"], boolean>>;
  }>({ path: pathname ?? null, open: {} });
  const panelIdBase = useId();
  const brvmPanelId = `${panelIdBase}-brvm`;
  const soonExchanges = comingSoonExchanges();
  const liveMarkets = liveSecondaryExchanges();
  const soonOpen = soonToggle.path === pathname ? soonToggle.open : {};

  useEffect(() => {
    if (brvmActive) setBrvmOpen(true);
  }, [brvmActive]);

  function toggleSoonMarket(code: AfricanExchange["code"]) {
    const current = isComingSoonMarketSectionOpen(pathname, code, soonOpen[code]);
    setSoonToggle({
      path: pathname ?? null,
      open: { ...soonOpen, [code]: !current },
    });
  }

  const brvmPages = (
    <>
      <NavLink
        href="/marche"
        label={t("chrome.nav.overview")}
        active={pathname === "/marche"}
        onClick={close}
        sidebar={sidebar}
      />
      <NavLink
        href="/indices"
        label={t("chrome.nav.indices")}
        active={isActive("/indices")}
        onClick={close}
        sidebar={sidebar}
      />
      <NavLink
        href="/screener"
        label={t("chrome.nav.screener")}
        active={isActive("/screener")}
        onClick={close}
        sidebar={sidebar}
      />
      <NavLink href="/graphes" label={t("chrome.nav.charts")} active={isActive("/graphes")} onClick={close} sidebar={sidebar} />
      <CompanyMegaMenu
        groups={sectorGroups}
        totalCount={totalCompanies}
        variant={sidebar ? "sidebar" : "inline"}
        onNavigate={close}
      />
      <NavLink
        href="/calendrier-dividendes"
        label={t("chrome.nav.dividends")}
        active={isActive("/calendrier-dividendes")}
        onClick={close}
        sidebar={sidebar}
      />
    </>
  );

  const links = (
    <>
      {sidebar ? <p className={styles.navGroupLabel}>{t("chrome.nav.invest")}</p> : null}
      <NavLink
        href="/portefeuille"
        label={t("chrome.nav.portfolio")}
        active={isActive("/portefeuille")}
        onClick={close}
        sidebar={sidebar}
      />
      <NavLink
        href="/simulation"
        label={t("chrome.nav.simulation")}
        active={isActive("/simulation")}
        onClick={close}
        sidebar={sidebar}
      />
      {user ? (
        <>
          <NavLink
            href="/notifications"
            label={t("chrome.nav.notifications")}
            active={isActive("/notifications")}
            onClick={close}
            sidebar={sidebar}
          />
          <NavLink
            href="/profil"
            label={t("chrome.nav.profile")}
            active={isActive("/profil") || isActive("/reglages")}
            onClick={close}
            sidebar={sidebar}
          />
        </>
      ) : null}

      {sidebar ? <p className={styles.navGroupLabel}>{t("chrome.nav.markets")}</p> : null}
      {sidebar ? (
        <MarketNavGroup
          label="BRVM"
          panelId={brvmPanelId}
          open={brvmOpen}
          onToggle={() => setBrvmOpen((open) => !open)}
          active={brvmActive}
          live
          pagesLabel={t("chrome.nav.pagesOf", { label: "BRVM" })}
        >
          {brvmPages}
        </MarketNavGroup>
      ) : (
        brvmPages
      )}
      {sidebar
        ? liveMarkets.map((exchange) => {
            const overviewHref = comingSoonMarketHref(exchange.code);
            const indicesHref = marketIndicesHref(exchange.code);
            const marketActive = isSecondaryMarketPath(pathname, exchange.code);
            const open = soonOpen[exchange.code] ?? marketActive;
            return (
              <MarketNavGroup
                key={exchange.code}
                label={exchange.shortLabel}
                panelId={`${panelIdBase}-${exchange.code.toLowerCase()}`}
                open={open}
                onToggle={() => {
                  const current = soonOpen[exchange.code] ?? marketActive;
                  setSoonToggle({
                    path: pathname ?? null,
                    open: { ...soonOpen, [exchange.code]: !current },
                  });
                }}
                active={marketActive}
                live
                pagesLabel={t("chrome.nav.pagesOf", { label: exchange.shortLabel })}
              >
                <NavLink
                  href={overviewHref}
                  label={t("chrome.nav.overview")}
                  active={pathname === overviewHref}
                  onClick={close}
                  sidebar={sidebar}
                />
                <NavLink
                  href={indicesHref}
                  label={t("chrome.nav.indices")}
                  active={isActive(indicesHref)}
                  onClick={close}
                  sidebar={sidebar}
                />
              </MarketNavGroup>
            );
          })
        : null}
      {sidebar
        ? soonExchanges.map((exchange) => {
            const overviewHref = comingSoonMarketHref(exchange.code);
            const indicesHref = marketIndicesHref(exchange.code);
            const overviewActive = pathname === overviewHref;
            const indicesActive = isActive(indicesHref);
            const marketActive = isComingSoonMarketNavPath(pathname, exchange.code);
            const open = isComingSoonMarketSectionOpen(pathname, exchange.code, soonOpen[exchange.code]);
            return (
              <MarketNavGroup
                key={exchange.code}
                label={exchange.shortLabel}
                panelId={`${panelIdBase}-${exchange.code.toLowerCase()}`}
                open={open}
                onToggle={() => toggleSoonMarket(exchange.code)}
                active={marketActive}
                badge={t("chrome.nav.soon")}
                pagesLabel={t("chrome.nav.pagesOf", { label: exchange.shortLabel })}
              >
                <NavLink
                  href={overviewHref}
                  label={t("chrome.nav.overview")}
                  active={overviewActive}
                  onClick={close}
                  sidebar={sidebar}
                  analyticsFeature="coming_soon_market"
                  analyticsAction={`nav:${exchange.code}`}
                />
                <NavLink
                  href={indicesHref}
                  label={t("chrome.nav.indices")}
                  active={indicesActive}
                  onClick={close}
                  sidebar={sidebar}
                  analyticsFeature="coming_soon_market"
                  analyticsAction={`nav-indices:${exchange.code}`}
                />
              </MarketNavGroup>
            );
          })
        : null}

      {sidebar ? <p className={styles.navGroupLabel}>{t("chrome.nav.resources")}</p> : null}
      <EducationMegaMenu variant={sidebar ? "sidebar" : "inline"} onNavigate={close} />
      <NavLink href="/actualites" label={t("chrome.nav.news")} active={isActive("/actualites")} onClick={close} sidebar={sidebar} />
      <NavLink href="/outils" label={t("chrome.nav.tools")} active={isActive("/outils")} onClick={close} sidebar={sidebar} />
      {user?.isAdmin ? (
        <>
          {sidebar ? <p className={styles.navGroupLabel}>{t("chrome.nav.admin")}</p> : null}
          <NavLink
            href="/admin/analytics"
            label={t("chrome.nav.analytics")}
            active={isActive("/admin/analytics")}
            onClick={close}
            sidebar={sidebar}
            skipAnalytics
          />
        </>
      ) : null}
    </>
  );

  return (
    <div style={cssVars}>
      <nav aria-label={t("chrome.nav.main")} className={sidebar ? styles.sidebarNav : styles.desktopNav}>
        {links}
      </nav>
    </div>
  );
}
