"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TFunc } from "@/lib/i18n/create-i18n";
import { localizeSharedApiMessage } from "@/lib/i18n/localize-api";
import { BRVM_DAILY_COLLAR_PCT } from "@/lib/notifications/types";
import styles from "./TickerAlertButton.module.css";

function alertButtonLabel(label: string | undefined, t: TFunc): string {
  if (!label || label === "Alerte") return t("notifications.alert.button");
  if (label === "Alerte au stop") return t("notifications.alert.stopButton");
  return label;
}

type Kind = "PRICE" | "DAILY" | "HORIZON" | "SIGNAL";

export default function TickerAlertButton({
  isAuthenticated,
  ticker,
  lastClose,
  loginCallbackPath,
  className,
  defaultTarget,
  defaultDirection,
  label,
}: {
  isAuthenticated: boolean;
  ticker: string;
  lastClose: number | null;
  loginCallbackPath?: string;
  className?: string;
  /** Seuil prérempli (ex. stop de la calculette). */
  defaultTarget?: number | null;
  defaultDirection?: "ABOVE" | "BELOW";
  label?: string;
}) {
  const { t, format, labels } = useI18n();
  const buttonLabel = alertButtonLabel(label, t);
  const buy = labels.signal("ACHAT");
  const strong = labels.signal("ACHAT FORT");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("PRICE");
  const [direction, setDirection] = useState<"ABOVE" | "BELOW">(defaultDirection ?? "ABOVE");
  const [target, setTarget] = useState("");
  const [percent, setPercent] = useState("3");
  const [horizon, setHorizon] = useState<"1S" | "1M">("1S");
  const [signal, setSignal] = useState<"ACHAT FORT" | "ACHAT">("ACHAT FORT");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultTarget != null && Number.isFinite(defaultTarget) && defaultTarget > 0) {
      setTarget(String(Math.round(defaultTarget)));
      return;
    }
    if (lastClose != null && Number.isFinite(lastClose)) setTarget(String(Math.round(lastClose)));
  }, [ticker, lastClose, defaultTarget]);

  useEffect(() => {
    if (defaultDirection) setDirection(defaultDirection);
  }, [defaultDirection]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!isAuthenticated) {
    const callback = loginCallbackPath ?? `/actions/${ticker}`;
    return (
      <Link
        href={`/connexion?callbackUrl=${encodeURIComponent(callback)}`}
        className={className ?? styles.btn}
      >
        {buttonLabel}
      </Link>
    );
  }

  async function create() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (kind === "PRICE") {
        const value = Number(String(target).replace(",", "."));
        if (!Number.isFinite(value) || value <= 0) {
          setError(t("notifications.alert.invalidTarget"));
          return;
        }
        const res = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker, direction, targetPrice: value }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(
            typeof json?.error === "string"
              ? localizeSharedApiMessage(json.error, t)
              : t("notifications.alert.createFailed")
          );
          return;
        }
        setMessage(
          json.data?.alert?.status === "TRIGGERED"
            ? t("notifications.alert.alreadyHit")
            : t("notifications.alert.priceCreated")
        );
        return;
      }

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
        setError(
            typeof json?.error === "string"
              ? localizeSharedApiMessage(json.error, t)
              : t("notifications.alert.createFailed")
          );
        return;
      }
      setMessage(t("notifications.alert.ruleCreated"));
    } catch {
      setError(t("notifications.alert.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={className ?? styles.btn} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      {open ? (
        <div className={styles.overlay} role="presentation" onClick={() => setOpen(false)}>
          <div
            className={styles.sheet}
            role="dialog"
            aria-label={t("notifications.alert.aria", { ticker })}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.title}>{t("notifications.alert.title", { ticker })}</h2>
            <p className={styles.hint}>
              {lastClose != null ? `${t("notifications.alert.currentPrice", { price: format.fcfa(lastClose) })} ` : ""}
              {t("notifications.alert.collar", { collar: BRVM_DAILY_COLLAR_PCT })}
            </p>
            <label className={styles.label}>
              {t("notifications.alert.type")}
              <select className={styles.input} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option value="PRICE">{t("notifications.alert.kindPrice")}</option>
                <option value="DAILY">{t("notifications.alert.kindDaily")}</option>
                <option value="HORIZON">{t("notifications.alert.kindHorizon")}</option>
                <option value="SIGNAL">{t("notifications.alert.kindSignal", { buy, strong })}</option>
              </select>
            </label>
            {kind === "PRICE" ? (
              <>
                <label className={styles.label}>
                  {t("notifications.alert.direction")}
                  <select className={styles.input} value={direction} onChange={(e) => setDirection(e.target.value as "ABOVE" | "BELOW")}>
                    <option value="ABOVE">{t("notifications.alert.above")}</option>
                    <option value="BELOW">{t("notifications.alert.below")}</option>
                  </select>
                </label>
                <label className={styles.label}>
                  {t("notifications.alert.thresholdFcfa")}
                  <input className={styles.input} type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
                </label>
              </>
            ) : null}
            {kind === "DAILY" || kind === "HORIZON" ? (
              <label className={styles.label}>
                {t("notifications.alert.thresholdPct")}
                <input className={styles.input} type="number" min={0.5} max={10} step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} />
              </label>
            ) : null}
            {kind === "HORIZON" ? (
              <label className={styles.label}>
                {t("notifications.alert.horizon")}
                <select className={styles.input} value={horizon} onChange={(e) => setHorizon(e.target.value as "1S" | "1M")}>
                  <option value="1S">{t("notifications.alert.week")}</option>
                  <option value="1M">{t("notifications.alert.month")}</option>
                </select>
              </label>
            ) : null}
            {kind === "SIGNAL" ? (
              <label className={styles.label}>
                {t("notifications.alert.signal")}
                <select className={styles.input} value={signal} onChange={(e) => setSignal(e.target.value as "ACHAT FORT" | "ACHAT")}>
                  <option value="ACHAT FORT">{strong}</option>
                  <option value="ACHAT">{t("notifications.alert.signalOr", { buy, strong })}</option>
                </select>
              </label>
            ) : null}
            {message ? <p className={styles.ok}>{message}</p> : null}
            {error ? <p className={styles.err}>{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.primary} disabled={saving} onClick={() => void create()}>
                {saving ? t("notifications.alert.creating") : t("notifications.alert.create")}
              </button>
              <button type="button" className={styles.ghost} onClick={() => setOpen(false)}>
                {t("notifications.alert.close")}
              </button>
              <Link href="/notifications" className={styles.ghost} style={{ textDecoration: "none" }}>
                {t("notifications.alert.center")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
