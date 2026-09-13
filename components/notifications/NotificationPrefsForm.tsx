"use client";

import { useEffect, useState } from "react";
import { BRVM_DAILY_COLLAR_PCT, DEFAULT_PREFS, type PrefsSnapshot } from "@/lib/notifications/types";
import styles from "./NotificationPrefsForm.module.css";

export default function NotificationPrefsForm() {
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
        setError("Impossible de charger les préférences.");
      }
    })();
  }, []);

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
        setError(json.error ?? "Enregistrement impossible.");
        return;
      }
      setPrefs(json.data.prefs as PrefsSnapshot);
      setMessage("Préférences enregistrées.");
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

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
        <h2 className={styles.title}>Types d&apos;alertes</h2>
        <p className={styles.lead}>Désactivez un type pour ne plus recevoir ces événements (in-app et e-mail).</p>
        {(
          [
            ["priceEnabled", "Prix", "Seuils FCFA, variation journalière, horizon 1S/1M"],
            ["signalEnabled", "Signaux", "Entrée en ACHAT / ACHAT FORT (max. 1/jour/titre)"],
            ["portfolioEnabled", "Portefeuille", "Mouvement fort, objectif / stop"],
            ["indexEnabled", "Indices", "BRVM Composite et BRVM 30"],
            ["systemEnabled", "Système", "Rappels d'ouverture / clôture"],
          ] as const
        ).map(([key, label, hint]) => (
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
        <h2 className={styles.title}>Canaux et rythme</h2>
        <label className={styles.row}>
          <span className={styles.label}>
            In-app
            <span className={styles.hint}>Centre de notifications et cloche du header</span>
          </span>
          <input
            type="checkbox"
            checked={prefs.channelInApp}
            onChange={(e) => toggle("channelInApp", e.target.checked)}
          />
        </label>
        <label className={styles.row}>
          <span className={styles.label}>
            E-mail
            <span className={styles.hint}>
              {emailAvailable
                ? "Envoi via Resend si une adresse est associée au compte"
                : "Non configuré sur ce déploiement (RESEND_API_KEY + EMAIL_FROM) — l'in-app reste actif"}
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
          <span className={styles.label}>Mode e-mail</span>
          <select
            className={styles.input}
            value={prefs.deliveryMode}
            onChange={(e) => toggle("deliveryMode", e.target.value as PrefsSnapshot["deliveryMode"])}
          >
            <option value="REALTIME">Temps réel (hors heures calmes)</option>
            <option value="DIGEST">Digest (envoi groupé en fin de séance)</option>
          </select>
        </label>
        <div className={styles.fields}>
          <label className={styles.field}>
            Début heures calmes
            <select
              className={styles.input}
              value={prefs.quietHoursStart ?? ""}
              onChange={(e) => toggle("quietHoursStart", e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">Aucune</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")} h
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Fin heures calmes
            <select
              className={styles.input}
              value={prefs.quietHoursEnd ?? ""}
              onChange={(e) => toggle("quietHoursEnd", e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">Aucune</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")} h
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={styles.lead} style={{ marginTop: 10 }}>
          Fuseau Africa/Abidjan. Les heures calmes différent uniquement l&apos;e-mail — l&apos;in-app reste immédiat.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.title}>Seuils portefeuille / indices</h2>
        <label className={styles.row}>
          <span className={styles.label}>
            Rappel ouverture / clôture
            <span className={styles.hint}>Si l&apos;évaluateur tourne vers 9h ou 15h–17h Abidjan</span>
          </span>
          <input
            type="checkbox"
            checked={prefs.sessionReminders}
            onChange={(e) => toggle("sessionReminders", e.target.checked)}
          />
        </label>
        <div className={styles.fields}>
          <label className={styles.field}>
            Mouvement ligne portefeuille (%)
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
            Mouvement indice (%)
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
          Collier BRVM typique : ±{BRVM_DAILY_COLLAR_PCT} % par séance (plafond saisi 10 %).
        </p>
      </section>

      <button type="submit" className={styles.save} disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer les préférences"}
      </button>
      {message ? <p className={styles.ok}>{message}</p> : null}
      {error ? <p className={styles.err}>{error}</p> : null}
    </form>
  );
}
