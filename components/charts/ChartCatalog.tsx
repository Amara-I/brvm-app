"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CompanyMark from "@/components/ui/CompanyMark";
import type { LogoMarket } from "@/components/ui/CompanyMark";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TFunc } from "@/lib/i18n/create-i18n";
import {
  filterChartCatalog,
  groupChartCatalog,
  type ChartCatalog,
  type ChartCatalogEntry,
  type ChartCatalogKind,
} from "@/lib/charts/chart-catalog-core";
import styles from "./ChartCatalog.module.css";

function isLogoMarket(exchange: string): exchange is LogoMarket {
  return exchange === "BRVM" || exchange === "NGX";
}

function groupTitle(exchange: string, kind: ChartCatalogKind, t: TFunc): string {
  return kind === "company"
    ? t("charts.catalog.groupActions", { exchange })
    : t("charts.catalog.groupIndices", { exchange });
}

function IndexMark({ exchange }: { exchange: string }) {
  const label = exchange.slice(0, 2).toUpperCase();
  return (
    <span className={styles.indexMark} aria-hidden="true">
      {label}
    </span>
  );
}

function CatalogRow({ item }: { item: ChartCatalogEntry }) {
  const market = isLogoMarket(item.exchange) ? item.exchange : undefined;
  return (
    <Link href={item.href} className={styles.row} title={`${item.name} (${item.symbol})`}>
      {item.kind === "company" ? (
        <CompanyMark ticker={item.symbol} name={item.name} size={24} market={market} />
      ) : (
        <IndexMark exchange={item.exchange} />
      )}
      <span className={styles.meta}>
        <span className={styles.symbolRow}>
          <span className={styles.symbol}>{item.symbol.replace(/_/g, " ")}</span>
          {item.countryFlag ? (
            <span className={styles.flag} aria-hidden="true">
              {item.countryFlag}
            </span>
          ) : null}
        </span>
        <span className={styles.name}>{item.name}</span>
      </span>
    </Link>
  );
}

export default function ChartCatalog({ catalog }: { catalog: ChartCatalog }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterChartCatalog(catalog.entries, query), [catalog.entries, query]);
  const groups = useMemo(() => groupChartCatalog(filtered), [filtered]);
  const hiddenTotal = catalog.hiddenCompanies + catalog.hiddenIndices;

  return (
    <div className={styles.wrap}>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("charts.catalog.searchPlaceholder")}
        aria-label={t("charts.catalog.searchAria")}
        className={styles.search}
        autoComplete="off"
      />
      {catalog.groups.length > 1 ? (
        <nav className={styles.jump} aria-label={t("charts.catalog.jump")}>
          {catalog.groups.map((group) => {
            const visible = groups.find((g) => g.id === group.id);
            const count = visible?.items.length ?? 0;
            return (
              <a
                key={group.id}
                href={`#graphe-${group.id}`}
                className={count === 0 ? styles.jumpLink : styles.jumpLinkActive}
              >
                {groupTitle(group.exchange, group.kind, t)}
                <span className={styles.jumpCount}>{count}</span>
              </a>
            );
          })}
        </nav>
      ) : null}
      {hiddenTotal > 0 ? (
        <p className={styles.hiddenNote}>
          {t(hiddenTotal > 1 ? "charts.catalog.hiddenMany" : "charts.catalog.hiddenOne", {
            count: hiddenTotal,
          })}
        </p>
      ) : null}
      {groups.length === 0 ? (
        <p className={styles.emptyFilter}>{t("charts.catalog.emptyFilter")}</p>
      ) : (
        <div className={styles.stack}>
          {groups.map((group) => (
            <section
              key={group.id}
              id={`graphe-${group.id}`}
              className={styles.group}
              aria-labelledby={`graphe-title-${group.id}`}
            >
              <h2 id={`graphe-title-${group.id}`} className={styles.groupTitle}>
                {groupTitle(group.exchange, group.kind, t)}
                <span className={styles.groupCount}>{group.items.length}</span>
              </h2>
              <div className={styles.grid}>
                {group.items.map((item) => (
                  <CatalogRow key={item.key} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChartsBackLink() {
  const { t } = useI18n();
  return (
    <Link href="/graphes" className={styles.back}>
      ← {t("charts.catalog.backToAll")}
    </Link>
  );
}
