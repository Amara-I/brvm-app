"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizeApiMessage } from "./chart-locale";
import { chartMarketConfig, type ChartMarket } from "@/lib/charts/chart-market";
import styles from "./ChartWorkbench.module.css";

type AlertDirection = "ABOVE" | "BELOW";
type AlertStatus = "ACTIVE" | "TRIGGERED" | "DISABLED";

export interface PriceAlertDto {
  id: string;
  ticker: string;
  direction: AlertDirection;
  targetPrice: number;
  note: string | null;
  status: AlertStatus;
  triggeredAt: string | null;
  triggerPrice: number | null;
  createdAt: string;
}

export default function ChartAlertControls({
  isAuthenticated,
  ticker,
  market = "BRVM",
  lastClose,
  loginCallbackPath,
}: {
  isAuthenticated: boolean;
  ticker: string;
  /** BRVM (FCFA entiers) ou NGX (naira, 2 décimales). */
  market?: ChartMarket;
  lastClose: number | null;
  loginCallbackPath?: string;
}) {
  const { t, format, labels } = useI18n();
  const marketCfg = chartMarketConfig(market);
  const isNgx = market === "NGX";
  const money = (value: number) => format.money(value, marketCfg.currency);
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlertDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<"PRICE" | "DAILY" | "HORIZON" | "SIGNAL">("PRICE");
  const [direction, setDirection] = useState<AlertDirection>("ABOVE");
  const [target, setTarget] = useState("");
  const [percent, setPercent] = useState("3");
  const [horizon, setHorizon] = useState<"1S" | "1M">("1S");
  const [signal, setSignal] = useState<"ACHAT FORT" | "ACHAT">("ACHAT FORT");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/alerts?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(localizeApiMessage(json.error ?? "Impossible de charger les alertes.", t));
        setAlerts([]);
        return;
      }
      setAlerts((json.data?.alerts ?? []) as PriceAlertDto[]);
    } catch {
      setError(t("charts.errors.loadAlerts"));
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, ticker, t]);

  useEffect(() => {
    if (open && isAuthenticated) void loadList();
  }, [open, isAuthenticated, loadList]);

  useEffect(() => {
    setMessage(null);
    setError(null);
    if (lastClose != null && Number.isFinite(lastClose)) {
      setTarget(isNgx ? lastClose.toFixed(marketCfg.priceDecimals) : String(Math.round(lastClose)));
    } else {
      setTarget("");
    }
  }, [ticker, lastClose, isNgx, marketCfg.priceDecimals]);

  async function createAlert() {
    if (!isAuthenticated) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (kind !== "PRICE") {
        const body =
          kind === "DAILY"
            ? { kind: "DAILY_MOVE", ticker, percent: Number(percent) }
            : kind === "HORIZON"
              ? { kind: "HORIZON_MOVE", ticker, percent: Number(percent), horizon }
              : { kind: "SIGNAL_ENTRY", ticker, signal };
        const res = await fetch("/api/alert-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(localizeApiMessage(json?.error ?? "Création impossible.", t));
          return;
        }
        setMessage(t("charts.alerts.ruleCreated"));
        return;
      }
      const value = Number(target.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) {
        setError(t("charts.errors.positiveThreshold"));
        return;
      }
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          direction,
          targetPrice: value,
          note: note.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(localizeApiMessage(json?.error ?? "Création impossible.", t));
        return;
      }
      const alert = json.data?.alert as PriceAlertDto | undefined;
      if (alert?.status === "TRIGGERED") {
        setMessage(
          t("charts.alerts.alreadyReached", { price: money(alert.triggerPrice ?? value) })
        );
      } else {
        setMessage(t("charts.alerts.created"));
      }
      setNote("");
      await loadList();
    } catch {
      setError(t("charts.errors.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function removeAlert(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(localizeApiMessage(json.error ?? "Suppression impossible.", t));
        return;
      }
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setMessage(t("charts.alerts.deleted"));
    } catch {
      setError(t("charts.errors.deleteFailed"));
    }
  }

  async function reactivate(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(localizeApiMessage(json.error ?? "Réactivation impossible.", t));
        return;
      }
      setMessage(t("charts.alerts.reactivated"));
      await loadList();
    } catch {
      setError(t("charts.errors.reactivateFailed"));
    }
  }

  if (!isAuthenticated) {
    const callback =
      loginCallbackPath ??
      (isNgx ? `/marches/ngx/actions/${encodeURIComponent(ticker)}` : `/graphes?ticker=${encodeURIComponent(ticker)}`);
    return (
      <Link
        href={`/connexion?callbackUrl=${encodeURIComponent(callback)}`}
        className={styles.ghostBtnEnabled}
        title={t("charts.alerts.signIn")}
      >
        {t("charts.alerts.button")}
      </Link>
    );
  }

  const triggeredCount = alerts.filter((a) => a.status === "TRIGGERED").length;

  return (
    <div className={styles.analysisMenuWrap}>
      <button
        type="button"
        className={open ? styles.toolPillActive : styles.ghostBtnEnabled}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {triggeredCount > 0 ? t("charts.alerts.buttonCount", { count: triggeredCount }) : t("charts.alerts.button")}
      </button>
      {open && (
        <div className={styles.analysisPanel} role="dialog" aria-label={t("charts.alerts.dialog")}>
          <p className={styles.analysisHint}>
            {lastClose != null
              ? t("charts.alerts.hintWithPrice", { ticker, price: money(lastClose) })
              : t("charts.alerts.hint", { ticker })}
          </p>
          <label className={styles.analysisLabel}>
            {t("charts.alerts.type")}
            <select
              className={styles.analysisInput}
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="PRICE">{isNgx ? t("charts.alerts.kindPriceNgn") : t("charts.alerts.kindPrice")}</option>
              <option value="DAILY">{t("charts.alerts.kindDaily")}</option>
              <option value="HORIZON">{t("charts.alerts.kindHorizon")}</option>
              <option value="SIGNAL">{t("charts.alerts.kindSignal")}</option>
            </select>
          </label>
          {kind === "PRICE" ? (
            <>
              <label className={styles.analysisLabel}>
                {t("charts.alerts.direction")}
                <select
                  className={styles.analysisInput}
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as AlertDirection)}
                >
                  <option value="ABOVE">{t("charts.alerts.above")}</option>
                  <option value="BELOW">{t("charts.alerts.below")}</option>
                </select>
              </label>
              <label className={styles.analysisLabel}>
                {isNgx ? t("charts.alerts.thresholdNgn") : t("charts.alerts.thresholdFcfa")}
                <input
                  className={styles.analysisInput}
                  type="number"
                  min={isNgx ? 0.01 : 1}
                  step="any"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>
              <label className={styles.analysisLabel}>
                {t("charts.alerts.note")}
                <input
                  className={styles.analysisInput}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder={t("charts.alerts.notePlaceholder")}
                />
              </label>
            </>
          ) : null}
          {kind === "DAILY" || kind === "HORIZON" ? (
            <label className={styles.analysisLabel}>
              {t("charts.alerts.thresholdPercent")}
              <input
                className={styles.analysisInput}
                type="number"
                min={0.5}
                max={10}
                step="0.1"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </label>
          ) : null}
          {kind === "HORIZON" ? (
            <label className={styles.analysisLabel}>
              {t("charts.alerts.horizon")}
              <select
                className={styles.analysisInput}
                value={horizon}
                onChange={(e) => setHorizon(e.target.value as "1S" | "1M")}
              >
                <option value="1S">{t("charts.alerts.week")}</option>
                <option value="1M">{t("charts.alerts.month")}</option>
              </select>
            </label>
          ) : null}
          {kind === "SIGNAL" ? (
            <label className={styles.analysisLabel}>
              {t("charts.alerts.signal")}
              <select
                className={styles.analysisInput}
                value={signal}
                onChange={(e) => setSignal(e.target.value as "ACHAT FORT" | "ACHAT")}
              >
                <option value="ACHAT FORT">{labels.signal("ACHAT FORT")}</option>
                <option value="ACHAT">{t("charts.alerts.signalBuyOrStrong")}</option>
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className={styles.analysisSaveBtn}
            disabled={saving}
            onClick={() => void createAlert()}
          >
            {saving ? t("charts.alerts.creating") : t("charts.alerts.create")}
          </button>
          {message && <p className={styles.analysisOk}>{message}</p>}
          {error && <p className={styles.analysisErr}>{error}</p>}
          <div className={styles.analysisListHead}>
            <span>{t("charts.alerts.mine", { ticker })}</span>
            <button type="button" className={styles.analysisLinkBtn} onClick={() => void loadList()}>
              {t("charts.alerts.refresh")}
            </button>
          </div>
          {loading ? (
            <p className={styles.analysisHint}>{t("common.loading")}</p>
          ) : alerts.length === 0 ? (
            <p className={styles.analysisHint}>{t("charts.alerts.none")}</p>
          ) : (
            <ul className={styles.analysisList}>
              {alerts.map((a) => (
                <li key={a.id} className={styles.analysisItem}>
                  <div>
                    <strong>
                      {a.direction === "ABOVE" ? "≥" : "≤"} {money(a.targetPrice)}
                    </strong>
                    <span>
                      {a.status === "TRIGGERED"
                        ? a.triggerPrice != null
                          ? t("charts.alerts.triggeredAt", { price: money(a.triggerPrice) })
                          : t("charts.alerts.triggered")
                        : t("charts.alerts.active")}
                      {a.note ? ` · ${a.note}` : ""}
                    </span>
                  </div>
                  <div className={styles.analysisItemActions}>
                    {a.status === "TRIGGERED" && (
                      <button type="button" className={styles.analysisLinkBtn} onClick={() => void reactivate(a.id)}>
                        {t("charts.alerts.reactivate")}
                      </button>
                    )}
                    <button type="button" className={styles.analysisDangerBtn} onClick={() => void removeAlert(a.id)}>
                      {t("charts.alerts.deleteShort")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
