"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Méga-menu "Sociétés cotées" — étape 11 (rebranding ouestBourse)
// ═══════════════════════════════════════════════════════════════════════════
// Reproduit la STRUCTURE du méga-menu de ouestbourse.com fourni en capture
// par l'utilisateur (colonnes par secteur, en-tête "LA COTE — N ÉMETTEURS",
// lien "Voir toutes les sociétés cotées, par secteur →") avec les VRAIES
// données de la base (`groupCompaniesBySector`, cf. lib/calc/market-summary-stats.ts).
//
// Divergence assumée par rapport à la capture (documentée plutôt que
// "corrigée en silence") : la colonne "variation" affiche toujours "N/D".
// La base ne stocke que des cours de clôture annuels/périodiques, jamais de
// variation intrajournalière réelle — afficher un "0,00 %" ou un chiffre
// inventé violerait le principe "Toute donnée manquante → N/D" du projet.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { SectorGroup } from "@/lib/calc/market-summary-stats";
import { C } from "@/lib/theme/colors";
import styles from "./MegaMenu.module.css";

const cssVars = {
  "--mm-border": C.border,
  "--mm-panelAlt": C.panel,
  "--mm-green": C.green,
  "--mm-textDim": C.textDim,
  "--mm-text": C.text,
  "--mm-bg": C.bg,
} as React.CSSProperties;

export default function CompanyMegaMenu({ groups, totalCount }: { groups: SectorGroup[]; totalCount: number }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.wrapper} ref={wrapperRef} style={cssVars}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        Sociétés cotées
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div id={panelId} role="menu" className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>La cote — {totalCount} émetteurs</span>
          </div>
          <div className={styles.panelGrid}>
            {groups.map((g) => (
              <div key={g.sector} className={styles.sectorCol}>
                <div className={styles.sectorHeading}>
                  {g.sector.toUpperCase()} <span className={styles.sectorCount}>({g.companies.length})</span>
                </div>
                {g.companies.map((co) => (
                  <Link
                    key={co.ticker}
                    href={`/societes-cotees#${co.ticker}`}
                    className={styles.companyRow}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    <span className={styles.companyName}>
                      <span aria-hidden="true">{co.countryFlag}</span>
                      <span className={styles.companyTicker}>{co.ticker}</span> {co.name}
                    </span>
                    <span className={styles.companyPrice}>
                      {co.lastPrice !== null ? `${co.lastPrice.toLocaleString("fr-FR")} FCFA` : "N/D"}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <div className={styles.panelFooter}>
            <Link href="/societes-cotees" className={styles.footerLink} onClick={() => setOpen(false)}>
              Voir toutes les sociétés cotées, par secteur →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
