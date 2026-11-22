"use client";

// Barre de navigation basse (téléphone, ≤ 860 px) : les 4 destinations les plus
// utilisées + le bouton « Menu » qui ouvre le tiroir existant. Sur desktop elle
// est masquée par CSS (la navigation latérale prend le relais).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TFunc } from "@/lib/i18n/create-i18n";
import styles from "./MobileBottomNav.module.css";

type Item = { href: string; labelKey: Parameters<TFunc>[0]; icon: React.ReactNode };

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const ITEMS: Item[] = [
  {
    href: "/marche",
    labelKey: "chrome.bottomNav.market",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 17l5-5 4 4 8-9" />
        <path d="M15 7h5v5" />
      </svg>
    ),
  },
  {
    href: "/screener",
    labelKey: "chrome.bottomNav.screener",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 5h18l-7 8v6l-4-2v-4z" />
      </svg>
    ),
  },
  {
    href: "/graphes",
    labelKey: "chrome.bottomNav.charts",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M5 20V10M12 20V4M19 20v-7" />
      </svg>
    ),
  },
  {
    href: "/portefeuille",
    labelKey: "chrome.bottomNav.portfolio",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    ),
  },
];

export default function MobileBottomNav({
  menuOpen,
  onToggleMenu,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const isActive = (href: string) => pathname === href || Boolean(pathname?.startsWith(`${href}/`));

  return (
    <nav className={styles.bar} aria-label={t("chrome.bottomNav.aria")} data-testid="mobile-bottom-nav">
      {ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={styles.item}
            data-active={active || undefined}
            aria-current={active ? "page" : undefined}
          >
            {item.icon}
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
      <button
        type="button"
        className={styles.item}
        data-active={menuOpen || undefined}
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
      >
        <svg {...ICON_PROPS}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span>{t("chrome.bottomNav.menu")}</span>
      </button>
    </nav>
  );
}
