"use client";

// Sous-menu NGX « Sociétés cotées » : mêmes catégories que l'annuaire, liens ?secteur=.

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ngxSectorGroupLabel } from "@/components/ngx/ngx-labels";
import { ExpandChevronMark } from "@/components/ui/ExpandChevron";
import { parseNgxSectorGroupSlug, type NgxSectorGroup, type NgxSectorGroupSlug } from "@/lib/ngx/sectors";
import styles from "./HeaderNav.module.css";

export type NgxListedNavCategory = {
  slug: NgxSectorGroupSlug;
  group: NgxSectorGroup;
  count: number;
};

const LISTED_PATH = "/marches/ngx/societes";

export default function NgxListedCategoryMenu({
  categories,
  sidebar,
  onNavigate,
}: {
  categories: NgxListedNavCategory[];
  sidebar?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const onListed = pathname === LISTED_PATH || Boolean(pathname?.startsWith(`${LISTED_PATH}/`));
  const [open, setOpen] = useState(onListed);
  const selected = onListed ? (searchParams.get("secteur") ?? "") : "";

  return (
    <div className={styles.listedMenu}>
      <div className={styles.listedMenuRow}>
        <Link
          href={LISTED_PATH}
          aria-current={onListed && !selected ? "page" : undefined}
          className={`${styles.navLink} ${sidebar ? styles.navLinkSidebar : ""} ${onListed ? styles.navLinkActive : ""}`}
          onClick={onNavigate}
        >
          {t("chrome.nav.companies")}
        </Link>
        {categories.length > 0 ? (
          <button
            type="button"
            className={styles.listedMenuToggle}
            aria-expanded={open}
            aria-controls="ngx-listed-categories"
            aria-label={t("ngx.listed.tocAria")}
            onClick={() => setOpen((value) => !value)}
          >
            <ExpandChevronMark expanded={open} />
          </button>
        ) : null}
      </div>
      {open && categories.length > 0 ? (
        <div id="ngx-listed-categories" className={styles.listedNested} role="group" aria-label={t("ngx.listed.tocAria")}>
          {categories.map((category) => {
            const href = `${LISTED_PATH}?secteur=${encodeURIComponent(category.slug)}`;
            const active = selected === category.slug;
            const group = category.group || parseNgxSectorGroupSlug(category.slug);
            const label = group ? ngxSectorGroupLabel(group, t) : category.slug;
            return (
              <Link
                key={category.slug}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`${styles.navLink} ${sidebar ? styles.navLinkSidebar : ""} ${active ? styles.navLinkActive : ""}`}
                onClick={onNavigate}
              >
                {label} ({category.count})
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
