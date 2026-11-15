"use client";

// Alerte de variation journalière sur un indice (règle INDEX_MOVE).
// Utilisée sur les pages d'indices NGX : la BRVM suit BRVM Composite /
// BRVM 30 via la préférence « Indices », la NGX via une règle par indice.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizeSharedApiMessage } from "@/lib/i18n/localize-api";
import { DEFAULT_INDEX_MOVE_PCT } from "@/lib/notifications/types";
import styles from "./TickerAlertButton.module.css";

type Rule = { id: string; kind: string; indexCode: string | null; params: unknown; enabled: boolean };

function rulePct(params: unknown): number | null {
  if (!params || typeof params !== "object") return null;
  const n = Number((params as Record<string, unknown>).percent);
  return Number.isFinite(n) ? n : null;
}

export default function IndexAlertButton({
  isAuthenticated,
  indexCode,
  indexName,
  lastValue,
  loginCallbackPath,
}: {
  isAuthenticated: boolean;
  indexCode: string;
  indexName: string;
  lastValue: number | null;
  loginCallbackPath: string;
}) {
  const { t, format } = useI18n();
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(String(DEFAULT_INDEX_MOVE_PCT).replace(".", ","));
  const [rules, setRules] = useState<Rule[]>([]);
  const [indexEnabled, setIndexEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [rulesRes, prefsRes] = await Promise.all([
        fetch(`/api/alert-rules?indexCode=${encodeURIComponent(indexCode)}`, { cache: "no-store" }),
        fetch("/api/notifications/preferences", { cache: "no-store" }),
      ]);
      const rulesJson = await rulesRes.json().catch(() => null);
      const prefsJson = await prefsRes.json().catch(() => null);
      if (rulesRes.ok && rulesJson?.ok) {
        setRules(((rulesJson.data?.rules ?? []) as Rule[]).filter((r) => r.kind === "INDEX_MOVE"));
      }
      if (prefsRes.ok && prefsJson?.ok) setIndexEnabled(Boolean(prefsJson.data?.prefs?.indexEnabled));
    } catch {
      /* liste facultative : la création reste possible */
    }
  }, [indexCode]);

  useEffect(() => {
    if (open && isAuthenticated) void load();
  }, [open, isAuthenticated, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!isAuthenticated) {
    return (
      <Link href={`/connexion?callbackUrl=${encodeURIComponent(loginCallbackPath)}`} className={styles.btn}>
        {t("notifications.indexAlert.button")}
      </Link>
    );
  }

  async function create() {
    setError(null);
    setMessage(null);
    const value = Number(String(percent).replace(",", "."));
    if (!Number.isFinite(value) || value < 0.5 || value > 10) {
      setError(t("notifications.indexAlert.invalidPct"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "INDEX_MOVE", indexCode, percent: value }),
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
      setMessage(t("notifications.indexAlert.created"));
      await load();
    } catch {
      setError(t("notifications.alert.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/alert-rules/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete");
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError(t("notifications.indexAlert.deleteFailed"));
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.btn} onClick={() => setOpen(true)} data-testid="index-alert-button">
        {t("notifications.indexAlert.button")}
      </button>
      {open ? (
        <div className={styles.overlay} role="presentation" onClick={() => setOpen(false)}>
          <div
            className={styles.sheet}
            role="dialog"
            aria-label={t("notifications.indexAlert.aria", { name: indexName })}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.title}>{t("notifications.indexAlert.title", { name: indexName })}</h2>
            <p className={styles.hint}>
              {lastValue != null
                ? `${t("notifications.indexAlert.currentLevel", { value: format.decimal(lastValue, 2) })} `
                : ""}
              {t("notifications.indexAlert.note")}
            </p>
            {indexEnabled === false ? (
              <p className={styles.hint} style={{ color: "var(--c-gold)" }}>
                {t("notifications.indexAlert.prefsOff")}{" "}
                <Link href="/profil" style={{ color: "var(--c-gold)", fontWeight: 700 }}>
                  {t("notifications.indexAlert.prefsLink")}
                </Link>
              </p>
            ) : null}
            <label className={styles.label}>
              {t("notifications.indexAlert.thresholdPct")}
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0.5}
                max={10}
                step="0.1"
                value={percent.replace(",", ".")}
                onChange={(e) => setPercent(e.target.value)}
              />
            </label>
            <div className={styles.label}>
              {t("notifications.indexAlert.mine")}
              {rules.length === 0 ? (
                <span style={{ color: "var(--c-textdim)" }}>{t("notifications.indexAlert.none")}</span>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                  {rules.map((rule) => {
                    const pct = rulePct(rule.params);
                    return (
                      <li
                        key={rule.id}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, color: "var(--c-text)" }}
                      >
                        <span>
                          {t("notifications.indexAlert.ruleLine", {
                            pct: pct == null ? "N/D" : format.decimal(pct, 1),
                          })}
                        </span>
                        <button type="button" className={styles.ghost} style={{ padding: "5px 10px" }} onClick={() => void remove(rule.id)}>
                          {t("notifications.indexAlert.delete")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
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
