"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SECTION_TITLE, PANEL_TEXT } from "@/lib/theme/typography";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TFunc } from "@/lib/i18n/create-i18n";
import {
  SOGB_STYLE_EXAMPLE,
  computePositionSize,
  type PositionSizeErrorCode,
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

function positionError(code: PositionSizeErrorCode, t: TFunc): string {
  switch (code) {
    case "capital_invalide":
      return t("tools.position.errors.capital_invalide");
    case "taux_invalide":
      return t("tools.position.errors.taux_invalide");
    case "prix_entree_invalide":
      return t("tools.position.errors.prix_entree_invalide");
    case "prix_stop_invalide":
      return t("tools.position.errors.prix_stop_invalide");
    case "stop_non_inferieur":
      return t("tools.position.errors.stop_non_inferieur");
    case "quantite_nulle":
      return t("tools.position.errors.quantite_nulle");
    default:
      return t("common.errorGeneric");
  }
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
  const { t, format } = useI18n();
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
        <h2 className={styles.exampleTitle}>{t("tools.position.exampleTitle")}</h2>
        <p className={styles.exampleBody}>
          {t("tools.position.exampleBody", { shares: t("tools.position.sharesStrong") })}
        </p>
        <p className={styles.exampleFormula}>{t("tools.position.formula")}</p>
        <div className={styles.exampleActions}>
          <button type="button" className={styles.btnGold} onClick={loadWorkedExample}>
            {t("tools.position.loadExample")}
          </button>
          <button type="button" className={styles.btnGhost} onClick={tryMyNumbers}>
            {t("tools.position.tryMine")}
          </button>
          <Link href="/education/taille-position/taille-de-position" className={styles.btnLink}>
            {t("tools.position.readMethod")}
          </Link>
        </div>
      </aside>

      <div className={styles.grid}>
        <form className={styles.form} onSubmit={(e) => e.preventDefault()} aria-label={t("tools.position.formAria")}>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 14 }}>{t("tools.position.parameters")}</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>{t("tools.position.hint")}</p>

          <label className={styles.label}>
            {t("tools.position.ticker")}
            <select
              className={styles.input}
              value={ticker}
              onChange={(e) => applyTicker(e.target.value)}
              aria-label={t("tools.position.tickerAria")}
            >
              <option value="">{t("tools.position.manual")}</option>
              {tickers.map((option) => (
                <option key={option.ticker} value={option.ticker}>
                  {option.ticker} — {option.name}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <p className={styles.priceMeta}>
              {selected.lastPrice != null
                ? t("tools.position.livePrice", { price: format.fcfa(selected.lastPrice) })
                : t("tools.position.liveNd")}
            </p>
          ) : null}
          {priceSource === "example" ? (
            <p className={styles.priceMeta}>{t("tools.position.examplePrices")}</p>
          ) : null}

          <label className={styles.label}>
            {t("tools.position.capital")}
            <input
              className={styles.input}
              inputMode="decimal"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </label>

          <label className={styles.label}>
            {t("tools.position.risk")}
            <input
              className={styles.input}
              inputMode="decimal"
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
            />
          </label>
          <p className={styles.hint}>{t("tools.position.riskHint")}</p>

          <label className={styles.label}>
            {t("tools.position.entry")}
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
            {t("tools.position.stop")}
            <input
              className={styles.input}
              inputMode="decimal"
              value={stop}
              onChange={(e) => setStop(e.target.value)}
            />
          </label>
          <p className={styles.hint}>{t("tools.position.stopHint")}</p>
        </form>

        <div className={styles.results}>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 14 }}>{t("tools.position.result")}</h2>

          {!result.ok ? (
            <p className={styles.error} role="alert">
              {positionError(result.code, t)}
            </p>
          ) : (
            <>
              <div className={styles.kpis}>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>{t("tools.position.qty")}</span>
                  <span className={styles.kpiValue}>
                    {t("tools.position.shares", { count: format.integer(result.shares) })}
                  </span>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>{t("tools.position.invested")}</span>
                  <span className={styles.kpiValue}>{format.fcfa(result.invested)}</span>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>{t("tools.position.riskBudget")}</span>
                  <span className={styles.kpiValue}>{format.fcfa(result.riskBudget)}</span>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>{t("tools.position.lossAtStop")}</span>
                  <span className={styles.kpiValue}>{format.fcfa(result.maxLossAtStop)}</span>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>{t("tools.position.capitalPct")}</span>
                  <span className={styles.kpiValue}>
                    {format.percent(result.maxLossPercentOfCapital, 2)}
                  </span>
                </div>
                <div className={styles.kpi}>
                  <span className={styles.kpiLabel}>{t("tools.position.riskPerShare")}</span>
                  <span className={styles.kpiValue}>{format.fcfa(result.riskPerShare)}</span>
                </div>
              </div>
              {result.roundingExceedsBudget ? (
                <p className={styles.note}>
                  {t("tools.position.rounding", {
                    shares: format.integer(result.shares),
                    budget: format.fcfa(result.riskBudget),
                    raw: format.number(result.sharesRaw, { maximumFractionDigits: 2 }),
                  })}
                </p>
              ) : (
                <p className={styles.note}>
                  {t("tools.position.raw", {
                    raw: format.number(result.sharesRaw, { maximumFractionDigits: 2 }),
                  })}
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
                label={t("tools.position.alert")}
                loginCallbackPath={`/outils/taille-position?ticker=${encodeURIComponent(ticker)}`}
                className={styles.btnGhost}
              />
            ) : null}
            {ticker ? (
              <Link href={`/actions/${ticker}`} className={styles.btnLink}>
                {t("tools.position.sheet", { ticker })}
              </Link>
            ) : null}
            <Link href="/education/taille-position" className={styles.eduLink}>
              {t("tools.position.education")}
            </Link>
          </div>
          {ticker && stopValue > 0 ? (
            <p className={styles.hint} style={{ marginTop: 10 }}>
              {isAuthenticated ? t("tools.position.alertHint") : t("tools.position.alertLogin")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
