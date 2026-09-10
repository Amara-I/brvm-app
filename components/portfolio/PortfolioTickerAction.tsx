"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PORTFOLIO_CHANGED_EVENT } from "@/lib/api/portfolio-trades-client";
import styles from "./PortfolioTickerAction.module.css";

export type PortfolioTickerSignal = {
  label: string;
  color: string;
  score?: number;
};

type Props = {
  ticker: string;
  isAuthenticated: boolean;
  signal: PortfolioTickerSignal;
  /** Classe CSS du bouton « + Ajouter au portefeuille » (ex. btnPrimary, primaryBtn). */
  addClassName: string;
};

/** Tickers détenus dans au moins un portefeuille de l'utilisateur connecté. */
export function usePortfolioTickers(isAuthenticated: boolean): Set<string> | null {
  const [tickers, setTickers] = useState<Set<string> | null>(null);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setTickers(new Set());
      return;
    }
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setTickers(new Set());
        return;
      }
      const set = new Set<string>();
      for (const p of json.data?.portfolios ?? []) {
        for (const h of p.holdings ?? []) {
          if (typeof h.ticker === "string") set.add(h.ticker.toUpperCase());
        }
      }
      setTickers(set);
    } catch {
      setTickers(new Set());
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void reload();
    const onChanged = () => {
      void reload();
    };
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PORTFOLIO_CHANGED_EVENT, onChanged);
  }, [reload]);

  return tickers;
}

/**
 * Bouton d'action portefeuille : « + Ajouter » si la ligne n'est pas détenue,
 * sinon le signal d'analyse (ACHAT / CONSERVER / …) avec lien vers le portefeuille.
 */
export default function PortfolioTickerAction({ ticker, isAuthenticated, signal, addClassName }: Props) {
  const heldTickers = usePortfolioTickers(isAuthenticated);
  const inPortfolio = heldTickers?.has(ticker.toUpperCase()) === true;

  if (!inPortfolio) {
    return (
      <Link href="/portefeuille" className={addClassName}>
        + Ajouter au portefeuille
      </Link>
    );
  }

  const title = [
    "Position en portefeuille",
    signal.label,
    signal.score != null ? `Score ${signal.score}/100` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href="/portefeuille"
      className={styles.signalBtn}
      style={{
        color: signal.color,
        borderColor: `${signal.color}88`,
        background: `${signal.color}18`,
      }}
      title={title}
    >
      <span className={styles.signalLabel}>{signal.label}</span>
      {signal.score != null ? <span className={styles.signalScore}>{signal.score}/100</span> : null}
    </Link>
  );
}
