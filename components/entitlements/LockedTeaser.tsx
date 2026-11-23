"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import styles from "./LockedTeaser.module.css";

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 1.5A3.5 3.5 0 0 0 4.5 5v1.25H3.75A1.25 1.25 0 0 0 2.5 7.5v5.25C2.5 13.44 3.06 14 3.75 14h8.5c.69 0 1.25-.56 1.25-1.25V7.5c0-.69-.56-1.25-1.25-1.25H11.5V5A3.5 3.5 0 0 0 8 1.5Zm2 4.75H6V5a2 2 0 1 1 4 0v1.25ZM8 9.25a1.1 1.1 0 0 1 .55 2.06v.94a.55.55 0 1 1-1.1 0v-.94A1.1 1.1 0 0 1 8 9.25Z"
      />
    </svg>
  );
}

function withCallback(href: string, callbackUrl: string): string {
  const url = new URL(href, "https://ouestbourse.local");
  url.searchParams.set("callbackUrl", callbackUrl || "/");
  return `${url.pathname}${url.search}`;
}

export default function LockedTeaser({
  compact = false,
  callbackUrl,
  title,
  body,
  label,
  children,
  className,
}: {
  /** Pastille / bouton (tableaux, fenêtres plus longues que 5 ans). */
  compact?: boolean;
  callbackUrl?: string;
  title?: string;
  body?: string;
  /** Libellé compact (ex. « 5A »). */
  label?: string;
  /** Contenu flouté derrière l’overlay (mode bloc). */
  children?: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const next = callbackUrl ?? pathname ?? "/";
  const registerHref = withCallback("/inscription", next);
  const loginHref = withCallback("/connexion", next);
  const lockLabel = label ?? t("entitlements.lock");

  if (compact) {
    return (
      <Link
        href={registerHref}
        className={`${styles.compact} ${className ?? ""}`.trim()}
        title={t("entitlements.chartRange")}
        aria-label={`${lockLabel} — ${t("entitlements.register")}`}
      >
        <LockIcon />
        {label ? <span>{label}</span> : <span className={styles.ghost} aria-hidden="true" />}
      </Link>
    );
  }

  return (
    <div className={`${styles.wrap} ${className ?? ""}`.trim()}>
      {children ? <div className={styles.blur}>{children}</div> : <div className={styles.blur} style={{ minHeight: 88 }} />}
      <div className={styles.overlay}>
        <span className={styles.lock}>
          <LockIcon size={16} />
          {t("entitlements.lock")}
        </span>
        <p className={styles.title}>{title ?? t("entitlements.title")}</p>
        <p className={styles.body}>{body ?? t("entitlements.body")}</p>
        <div className={styles.actions}>
          <Link href={registerHref} className="ob-btn-gold">
            {t("entitlements.register")}
          </Link>
          <Link href={loginHref} className="ob-btn-secondary">
            {t("entitlements.login")}
          </Link>
        </div>
      </div>
    </div>
  );
}
