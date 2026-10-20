"use client";

import { useId, useState, type MouseEvent, type ReactNode } from "react";
import styles from "./ExpandChevron.module.css";

/** Lucide `ChevronRight` — trait 2, rotation 90° à l’ouverture. */
export function ChevronRightIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m9 18 6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ButtonProps = {
  expanded: boolean;
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  controls?: string;
};

/** Bouton chevron 30×30, pour une ligne qui reste elle aussi cliquable. */
export default function ExpandChevron({ expanded, label, onClick, controls }: ButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.hit} ${expanded ? styles.open : ""}`}
      aria-expanded={expanded}
      aria-label={label}
      aria-controls={controls}
      onClick={onClick}
    >
      <ChevronRightIcon />
    </button>
  );
}

/** Même dessin, à l’intérieur d’un bouton de ligne déjà existant. */
export function ExpandChevronMark({ expanded }: { expanded: boolean }) {
  return (
    <span className={`${styles.hit} ${styles.mark} ${expanded ? styles.open : ""}`} aria-hidden="true">
      <ChevronRightIcon />
    </span>
  );
}

export function ExpandSection({
  title,
  children,
  className,
  buttonClassName,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <section className={className}>
      <button
        type="button"
        className={buttonClassName}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <ExpandChevronMark expanded={open} />
        <span>{title}</span>
      </button>
      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
