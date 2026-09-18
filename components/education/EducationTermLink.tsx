"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { getTermBySlug } from "@/lib/education/catalog";
import styles from "./EducationTermLink.module.css";

type Props = {
  slug: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function truncateTip(text: string, max = 220): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** Lien vers la fiche Éducation : survol = définition courte, clic = page exhaustive. */
export default function EducationTermLink({ slug, children, className, style }: Props) {
  const term = getTermBySlug(slug);
  const tipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    let left = r.left;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    if (left < 12) left = 12;
    let top = r.bottom + 8;
    if (top + 140 > window.innerHeight) top = Math.max(8, r.top - 8 - 140);
    setCoords({ top, left });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => setOpen(false), []);

  if (!term) return <>{children ?? slug}</>;

  const href = `/education/${term.themeSlug}/${term.slug}`;
  const tip = truncateTip(term.definition);

  return (
    <span
      ref={wrapRef}
      className={styles.wrap}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <Link
        href={href}
        className={`${styles.link} ${className ?? ""}`.trim()}
        style={style}
        aria-describedby={open ? tipId : undefined}
      >
        {children ?? term.title}
      </Link>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              className={styles.tip}
              style={{ top: coords.top, left: coords.left }}
            >
              <span className={styles.tipTitle}>{term.title}</span>
              <span className={styles.tipBody}>{tip}</span>
              <span className={styles.tipHint}>Cliquer pour la fiche Éducation</span>
            </span>,
            document.body
          )
        : null}
    </span>
  );
}

export function educationTermHref(slug: string): string | null {
  const term = getTermBySlug(slug);
  if (!term) return null;
  return `/education/${term.themeSlug}/${term.slug}`;
}

/** Slugs Éducation pour les colonnes du tableau portefeuille. */
export const PORTFOLIO_TABLE_TERM_SLUGS: Record<string, string> = {
  pru: "pru",
  cost: "cout-d-achat",
  unitPrice: "cours-au",
  value: "valeur-de-marche",
  asOf: "cours-au",
  horizon: "horizon-d-achat",
  pnl: "plus-moins-value-latente",
  score: "score-composite",
  advice: "conseil-portefeuille",
};
