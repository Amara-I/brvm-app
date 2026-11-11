"use client";

// En-tête commun des vues d'ensemble marché (BRVM / NGX) :
// identité, dernière MAJ, bouton d'actualisation, KPI et bandeau d'indices.

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { MarketSummarySnapshot } from "@/lib/api/market-summary-snapshot";
import marketStyles from "@/components/marche/MarketChrome.module.css";
import styles from "@/components/marche/MarketBoard.module.css";
import { C } from "@/lib/theme/colors";
import ChangeValue from "@/components/ui/ChangeValue";
import { translateExchangeName, translateExchangeRegion } from "@/components/marche/market-copy";

export interface MarketChromeProps {
  lastUpdate: string;
  refreshing: boolean;
  onRefresh: () => void;
  companiesCount: number;
  totalMktCap: number;
  buySignals: number;
  avgYield: string;
  indexPills: MarketSummarySnapshot["headlineIndices"];
  currency: string;
  exchangeCode: string;
  exchangeName: string;
  region: string;
  /** Libellé devise dans la ligne méta, ex. « NGN (naira ₦) ». Défaut : currency. */
  currencyLabel?: string;
  /** Devise affichée sur le KPI de capitalisation. Défaut : currency. */
  capCurrency?: string;
  indexHref?: (code: string) => string;
  indicesFallbackHref?: string;
}

export default function MarketChrome(props: MarketChromeProps) {
  const { t, format } = useI18n();
  const region = translateExchangeRegion(props.exchangeCode, props.region, t);
  const currencyLabel = props.currencyLabel ?? props.currency;
  const capCurrency = props.capCurrency ?? props.currency;
  const indexHref = props.indexHref ?? ((code: string) => `/indices/${code}`);
  const indicesFallbackHref = props.indicesFallbackHref ?? "/indices";
  const kpis: Array<{
    key: string;
    l: string;
    v: string | { amount: string; unit: string };
    c: string;
  }> = [
    { key: "listed", l: t("market.kpi.listed"), v: String(props.companiesCount), c: C.blue },
    {
      key: "cap",
      l: t("market.kpi.totalCap"),
      v:
        props.totalMktCap > 0
          ? {
              amount: format.number(props.totalMktCap),
              unit: t("market.capUnit", { currency: capCurrency }),
            }
          : "N/D",
      c: C.gold,
    },
    { key: "yield", l: t("market.kpi.avgYield"), v: props.avgYield, c: C.green },
    { key: "buy", l: t("market.kpi.buySignals"), v: String(props.buySignals), c: C.green },
  ];
  return (
    <div className={marketStyles.shell}>
      <div className={marketStyles.topBar}>
        <div className={marketStyles.topRow}>
          <div>
            <div className={marketStyles.label}>{t("market.title")}</div>
            <h1 className={marketStyles.pageTitle}>{t("market.overview")}</h1>
            <p className={marketStyles.marketIdentity}>
              {translateExchangeName(props.exchangeCode, props.exchangeName, t)}
            </p>
            <p className={marketStyles.marketMeta}>
              {t("market.exchange.meta", { region, currency: currencyLabel })}
            </p>
          </div>
          <div className={marketStyles.actions}>
            <div style={{ fontSize: "0.72rem", color: C.textDim }}>
              <span className="ob-live-dot ob-pulse" aria-hidden="true" />
              {t("market.lastUpdate")} <span style={{ color: C.gold }}>{props.lastUpdate}</span>
            </div>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={props.onRefresh}
              disabled={props.refreshing}
              aria-label={props.refreshing ? t("market.refreshingAria", { market: props.exchangeCode }) : t("market.refreshAria", { market: props.exchangeCode })}
            >
              {props.refreshing ? t("market.refreshing") : t("market.refresh")}
            </button>
          </div>
        </div>
      </div>

      <div className={marketStyles.kpiStrip}>
        {kpis.map((k) => (
          <div key={k.key} className={marketStyles.kpiCard}>
            <div className={marketStyles.kpiLabel}>{k.l}</div>
            <div
              className={
                typeof k.v === "object"
                  ? `${marketStyles.kpiValue} ${marketStyles.kpiValueStack}`
                  : `${marketStyles.kpiValue} ob-num`
              }
              style={{ color: k.c }}
            >
              {k.v === "N/D" ? (
                <span className="ob-nd">N/D</span>
              ) : typeof k.v === "object" ? (
                <>
                  <span className={`${marketStyles.kpiAmount} ob-num`}>{k.v.amount}</span>
                  <span className={marketStyles.kpiUnit}>{k.v.unit}</span>
                </>
              ) : (
                k.v
              )}
            </div>
          </div>
        ))}
      </div>
      <div className={marketStyles.indicesStrip} aria-label={t("market.indicesAria")}>
        {props.indexPills.length === 0 ? (
          <Link href={indicesFallbackHref} className={marketStyles.indexPill}>
            <div className={marketStyles.indexName}>{t("market.indices.title")}</div>
            <div className={marketStyles.indexValue} style={{ color: C.textDim }}>
              N/D
            </div>
          </Link>
        ) : (
          props.indexPills.map((idx) => (
            <Link key={idx.code} href={indexHref(idx.code)} className={marketStyles.indexPill}>
              <div className={marketStyles.indexName}>{idx.name}</div>
              <div className={`${marketStyles.indexValue} ob-num`}>
                {format.number(idx.value, { maximumFractionDigits: 2 })}
              </div>
              <div className={marketStyles.indexChg}>
                <ChangeValue value={idx.changePercent} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
