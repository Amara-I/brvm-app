"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizeSharedApiMessage } from "@/lib/i18n/localize-api";
import { BRVM_DAILY_COLLAR_MAX_PCT, BRVM_DAILY_COLLAR_PCT, DEFAULT_PREFS, type PrefsSnapshot } from "@/lib/notifications/types";
import styles from "./NotificationPrefsForm.module.css";

export default function NotificationPrefsForm() {
  const { t, labels } = useI18n();
  const [prefs, setPrefs] = useState<PrefsSnapshot>(DEFAULT_PREFS);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/notifications/preferences", { cache: "no-store" });
        const json = await res.json();
        if (res.ok && json.ok && json.data?.prefs) {
          setPrefs(json.data.prefs as PrefsSnapshot);
          setEmailAvailable(Boolean(json.data.emailAvailable));
        }
      } catch {
        setError(t("notifications.prefs.loadError"));
      }
    })();
  }, [t]);

  function toggle<K extends keyof PrefsSnapshot>(key: K, value: PrefsSnapshot[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(
          typeof json.error === "string"
            ? localizeSharedApiMessage(json.error, t)
            : t("notifications.prefs.saveError")
        );
        return;
      }
      setPrefs(json.data.prefs as PrefsSnapshot);
      setMessage(t("notifications.prefs.saved"));
    } catch {
      setError(t("notifications.prefs.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const buy = labels.signal("ACHAT");
  const strong = labels.signal("ACHAT FORT");
  const rows = [
    ["priceEnabled", t("notifications.types.price"), t("notifications.prefs.priceHint")],
    ["signalEnabled", t("notifications.types.signals"), t("notifications.prefs.signalHint", { buy, strong })],
    ["portfolioEnabled", t("notifications.types.portfolio"), t("notifications.prefs.portfolioHint")],
    ["indexEnabled", t("notifications.types.indices"), t("notifications.prefs.indexHint")],
    ["systemEnabled", t("notifications.types.system"), t("notifications.prefs.systemHint")],
  ] as const;

  return (
    <form
      id="alertes"
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <section className={styles.section}>
        <h2 className={styles.title}>{t("notifications.prefs.typesTitle")}</h2>
        <p className={styles.lead}>{t("notifications.prefs.typesLead")}</p>
        {rows.map(([key, label, hint]) => (
          <label key={key} className={styles.row}>
            <span className={styles.label}>
              {label}
              <span className={styles.hint}>{hint}</span>
            </span>
            <input
              type="checkbox"
              checked={Boolean(prefs[key])}
              onChange={(e) => toggle(key, e.target.checked)}
            />
          </label>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.title}>{t("notifications.prefs.channelsTitle")}</h2>
        <label className={styles.row}>
          <span className={styles.label}>
            {t("notifications.prefs.inApp")}
            <span className={styles.hint}>{t("notifications.prefs.inAppHint")}</span>
          </span>
          <input
            type="checkbox"
            checked={prefs.channelInApp}
            onChange={(e) => toggle("channelInApp", e.target.checked)}
          />
        </label>
        <label className={styles.row}>
          <span className={styles.label}>
            {t("notifications.prefs.email")}
            <span className={styles.hint}>
              {emailAvailable ? t("notifications.prefs.emailOn") : t("notifications.prefs.emailOff")}
            </span>
          </span>
          <input
            type="checkbox"
            checked={prefs.channelEmail}
            onChange={(e) => toggle("channelEmail", e.target.checked)}
            disabled={!emailAvailable}
          />
        </label>
        <label className={styles.row}>
          <span className={styles.label}>{t("notifications.prefs.emailMode")}</span>
          <select
            className={styles.input}
            value={prefs.deliveryMode}
            onChange={(e) => toggle("deliveryMode", e.target.value as PrefsSnapshot["deliveryMode"])}
          >
            <option value="REALTIME">{t("notifications.prefs.realtime")}</option>
            <option value="DIGEST">{t("notifications.prefs.digest")}</option>
          </select>
        </label>
        <div className={styles.fields}>
          <label className={styles.field}>
            {t("notifications.prefs.quietStart")}
            <select
              className={styles.input}
              value={prefs.quietHoursStart ?? ""}
              onChange={(e) => toggle("quietHoursStart", e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">{t("notifications.prefs.quietNone")}</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {t("notifications.prefs.hour", { hour: String(h).padStart(2, "0") })}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            {t("notifications.prefs.quietEnd")}
            <select
              className={styles.input}
              value={prefs.quietHoursEnd ?? ""}
              onChange={(e) => toggle("quietHoursEnd", e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">{t("notifications.prefs.quietNone")}</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {t("notifications.prefs.hour", { hour: String(h).padStart(2, "0") })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={styles.lead} style={{ marginTop: 10 }}>
          {t("notifications.prefs.quietNote")}
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.title}>{t("notifications.prefs.thresholdsTitle")}</h2>
        <label className={styles.row}>
          <span className={styles.label}>
            {t("notifications.prefs.session")}
            <span className={styles.hint}>{t("notifications.prefs.sessionHint")}</span>
          </span>
          <input
            type="checkbox"
            checked={prefs.sessionReminders}
            onChange={(e) => toggle("sessionReminders", e.target.checked)}
          />
        </label>
        <div className={styles.fields}>
          <label className={styles.field}>
            {t("notifications.prefs.portfolioMove")}
            <input
              className={styles.input}
              type="number"
              min={0.5}
              max={10}
              step="0.1"
              value={prefs.portfolioMovePct}
              onChange={(e) => toggle("portfolioMovePct", Number(e.target.value))}
            />
          </label>
          <label className={styles.field}>
            {t("notifications.prefs.indexMove")}
            <input
              className={styles.input}
              type="number"
              min={0.5}
              max={10}
              step="0.1"
              value={prefs.indexMovePct}
              onChange={(e) => toggle("indexMovePct", Number(e.target.value))}
            />
          </label>
        </div>
        <p className={styles.lead} style={{ marginTop: 10 }}>
          {t("notifications.prefs.collar", { collar: BRVM_DAILY_COLLAR_PCT, max: BRVM_DAILY_COLLAR_MAX_PCT })}
        </p>
      </section>

      <button type="submit" className={styles.save} disabled={saving}>
        {saving ? t("notifications.prefs.saving") : t("notifications.prefs.save")}
      </button>
      {message ? <p className={styles.ok}>{message}</p> : null}
      {error ? <p className={styles.err}>{error}</p> : null}
    </form>
  );
}
