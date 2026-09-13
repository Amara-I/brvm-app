"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { C } from "@/lib/theme/colors";
import { SECTION_TITLE, PANEL_TEXT } from "@/lib/theme/typography";
import {
  SOGB_STYLE_EXAMPLE,
  computePositionSize,
  type PositionSizeResult,
} from "@/lib/calc/position-size";
import TickerAlertButton from "@/components/notifications/TickerAlertButton";
import styles from "./PositionSizeCalculator.module.css";

export type PositionTickerOption = {
  ticker: string;
  name: string;
  lastPrice: number | null;
};

function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtFcfa(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function fmtPct(n: number): string {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}

function emptyIfZero(n: number): string {
  return n > 0 ? String(n) : "";
}

export default function PositionSizeCalculator({
  tickers,
  isAuthenticated,
  initialTicker,
  loadExample,
}: {
  tickers: PositionTickerOption[];
  isAuthenticated: boolean;
  initialTicker?: string;
  loadExample?: boolean;
}) {
  const resolvedInitial = useMemo(() => {
    const fromQuery = initialTicker?.toUpperCase() ?? "";
    if (fromQuery && tickers.some((t) => t.ticker === fromQuery)) return fromQuery;
    return "";
  }, [initialTicker, tickers]);

  const initialQuote = tickers.find((t) => t.ticker === resolvedInitial);

  const [ticker, setTicker] = useState(resolvedInitial);
  const [capital, setCapital] = useState(loadExample ? String(SOGB_STYLE_EXAMPLE.capital) : "1000000");
  const [risk, setRisk] = useState(loadExample ? String(SOGB_STYLE_EXAMPLE.riskPercent) : "5");
  const [entry, setEntry] = useState(() => {
    if (loadExample) return String(SOGB_STYLE_EXAMPLE.entryPrice);
    return emptyIfZero(initialQuote?.lastPrice ?? 0);
  });
  const [stop, setStop] = useState(loadExample ? String(SOGB_STYLE_EXAMPLE.stopPrice) : "");
  const [priceSource, setPriceSource] = useState<"live" | "example" | "manual">(
    loadExample ? "example" : initialQuote?.lastPrice ? "live" : "manual"
  );

  const selected = tickers.find((t) => t.ticker === ticker);

  const result: PositionSizeResult = useMemo(
    () =>
      computePositionSize({
        capital: parseAmount(capital),
        riskPercent: parseAmount(risk),
        entryPrice: parseAmount(entry),
        stopPrice: parseAmount(stop),
      }),
    [capital, risk, entry, stop]
  );

  function applyTicker(next: string) {
    setTicker(next);
    if (!next) {
      setPriceSource("manual");
      return;
    }
    const quote = tickers.find((t) => t.ticker === next);
    if (quote?.lastPrice != null && quote.lastPrice > 0) {
      setEntry(String(quote.lastPrice));
      setPriceSource("live");
    } else {
      setEntry("");
      setPriceSource("manual");
    }
  }

  function loadWorkedExample() {
    setTicker(SOGB_STYLE_EXAMPLE.ticker);
    setCapital(String(SOGB_STYLE_EXAMPLE.capital));
    setRisk(String(SOGB_STYLE_EXAMPLE.riskPercent));
    setEntry(String(SOGB_STYLE_EXAMPLE.entryPrice));
    setStop(String(SOGB_STYLE_EXAMPLE.stopPrice));
    setPriceSource("example");
  }

  function tryMyNumbers() {
    const quote = selected ?? tickers.find((t) => t.ticker === SOGB_STYLE_EXAMPLE.ticker);
    setCapital("1000000");
    setRisk("5");
    setStop("");
    if (quote?.lastPrice != null && quote.lastPrice > 0) {
      setTicker(quote.ticker);
      setEntry(String(quote.lastPrice));
      setPriceSource("live");
    } else {
      setEntry("");
      setPriceSource("manual");
    }
  }

  const stopValue = parseAmount(stop);

  return (
    <div className={styles.wrap} data-align-left>
      <aside className={styles.exampleCard}>
        <h2 className={styles.exampleTitle}>Exemple travaillé — SOGB CI (SOGC)</h2>
        <p className={styles.exampleBody}>
          Capital 1&nbsp;000&nbsp;000 FCFA, risque 5&nbsp;%, entrée 8&nbsp;400 FCFA, stop 7&nbsp;560 FCFA →{" "}
          <strong style={{ color: C.text }}>60 titres</strong>, perte max acceptée 50&nbsp;000 FCFA. Chiffres
          pédagogiques du tutoriel, pas un cours live.
        </p>
        <p className={styles.exampleFormula}>Q = (capital × taux %) / (entrée − stop)</p>
        <div className={styles.exampleActions}>
          <button type="button" className={styles.btnGold} onClick={loadWorkedExample}>
            Charger l’exemple
          </button>
          <button type="button" className={styles.btnGhost} onClick={tryMyNumbers}>
            Essayer avec mes chiffres
          </button>
          <Link href="/education/taille-position/taille-de-position" className={styles.btnLink}>
            Lire la méthode
          </Link>
        </div>
      </aside>

      <div className={styles.grid}>
        <form className={styles.form} onSubmit={(e) => e.preventDefault()} aria-label="Paramètres de taille de position">
          <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 14 }}>Paramètres</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>
            Suggéré pour un particulier BRVM : 3 à 5&nbsp;% du capital par trade. Outil pédagogique, pas un
            conseil d’investissement.
          </p>

          <label className={styles.label}>
            Titre (optionnel)
            <select
              className={styles.input}
              value={ticker}
              onChange={(e) => applyTicker(e.target.value)}
              aria-label="Choisir un ticker"
            >
              <option value="">Saisie manuelle</option>
              {tickers.map((t) => (
                <option key={t.ticker} value={t.ticker}>
                  {t.ticker} — {t.name}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <p className={styles.priceMeta}>
              {selected.lastPrice != null
                ? `Cours en base : ${fmtFcfa(selected.lastPrice)} — chargé comme prix d’entrée.`
                : "Cours en base : N/D — saisissez le prix d’entrée vous-même (aucun cours inventé)."}
            </p>
          ) : null}
          {priceSource === "example" ? (
            <p className={styles.priceMeta}>Prix d’entrée et stop : exemple pédagogique (pas le cours live).</p>
          ) : null}

          <label className={styles.label}>
            Capital total (FCFA)
            <input
              className={styles.input}
              inputMode="decimal"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </label>

          <label className={styles.label}>
            Taux de perte acceptable (% du capital)
            <input
              className={styles.input}
              inputMode="decimal"
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
            />
          </label>
          <p className={styles.hint}>Repère courant : 3–5 % par position pour un particulier sur la BRVM.</p>

          <label className={styles.label}>
            Prix d’entrée (FCFA)
            <input
              className={styles.input}
              inputMode="decimal"
              value={entry}
              onChange={(e) => {
                setEntry(e.target.value);
                setPriceSource(priceSource === "live" ? "live" : "manual");
              }}
            />
          </label>

          <label className={styles.label}>
            Stop loss (FCFA)
            <input
              className={styles.input}
              inputMode="decimal"
              value={stop}
              onChange={(e) => setStop(e.target.value)}
            />
          </label>
          <p className={styles.hint}>
            Pour un achat, le stop doit être inférieur à l’entrée. La BRVM n’offre pas d’ordre stop natif :
            couplez le calcul à une alerte de cours.
          </p>
        </form>

        <div className={styles.results}>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 14 }}>Résultat</h2>

          {!result.ok ? (
            <p className={styles.error} role="alert">
              {result.message}
            </p>
          ) : (
            <>
              <div className={styles.kpis}>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Quantité recommandée</span>
                  <span className={styles.kpiValue}>{result.shares.toLocaleString("fr-FR")} titres</span>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Montant investi</span>
                  <span className={styles.kpiValue}>{fmtFcfa(result.invested)}</span>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Perte max (budget)</span>
                  <span className={styles.kpiValue}>{fmtFcfa(result.riskBudget)}</span>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Perte si stop touché</span>
                  <span className={styles.kpiValue}>{fmtFcfa(result.maxLossAtStop)}</span>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>% du capital</span>
                  <span className={styles.kpiValue}>{fmtPct(result.maxLossPercentOfCapital)}</span>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>Risque / titre</span>
                  <span className={styles.kpiValue}>{fmtFcfa(result.riskPerShare)}</span>
                </div>
              </div>
              {result.roundingExceedsBudget ? (
                <p className={styles.note}>
                  L’arrondi à {result.shares} titres fait légèrement dépasser le budget (
                  {fmtFcfa(result.riskBudget)}). Quantité brute :{" "}
                  {result.sharesRaw.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}.
                </p>
              ) : (
                <p className={styles.note}>
                  Quantité brute : {result.sharesRaw.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} titres.
                </p>
              )}
            </>
          )}

          <div className={styles.actions}>
            {ticker && stopValue > 0 ? (
              <TickerAlertButton
                isAuthenticated={isAuthenticated}
                ticker={ticker}
                lastClose={parseAmount(entry) || selected?.lastPrice || null}
                defaultTarget={stopValue}
                defaultDirection="BELOW"
                label="Alerte au stop"
                loginCallbackPath={`/outils/taille-position?ticker=${encodeURIComponent(ticker)}`}
                className={styles.btnGhost}
              />
            ) : null}
            {ticker ? (
              <Link href={`/actions/${ticker}`} className={styles.btnLink}>
                Fiche {ticker}
              </Link>
            ) : null}
            <Link href="/education/taille-position" className={styles.eduLink}>
              Éducation · Taille de position
            </Link>
          </div>
          {ticker && stopValue > 0 ? (
            <p className={styles.hint} style={{ marginTop: 10 }}>
              {isAuthenticated
                ? "Le bouton Alerte préremplit un seuil « cours ≤ stop » (pas un ordre de bourse)."
                : "Connectez-vous pour créer une alerte au niveau du stop."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
