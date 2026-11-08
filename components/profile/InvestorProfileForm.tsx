"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { messageFromAuthJson } from "@/components/auth/api-message";
import styles from "@/components/auth/AuthForm.module.css";
import profileStyles from "./Profile.module.css";
import {
  INVESTOR_CAPACITIES,
  INVESTOR_HORIZONS,
  INVESTOR_LOSS_TOLERANCES,
  INVESTOR_OBJECTIVES,
  riskPercentForProfile,
  type InvestorCapacity,
  type InvestorCriteria,
  type InvestorHorizon,
  type InvestorLossTolerance,
  type InvestorObjective,
} from "@/lib/portfolio-analysis/criteria";

function numToInput(value: number | null): string {
  return value == null ? "" : String(value);
}

export default function InvestorProfileForm({
  initial,
  tableReady,
}: {
  initial: InvestorCriteria;
  tableReady: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [age, setAge] = useState(numToInput(initial.age));
  const [horizon, setHorizon] = useState(initial.horizon ?? "");
  const [capacity, setCapacity] = useState(initial.capacity ?? "");
  const [loss, setLoss] = useState(initial.lossTolerance ?? "");
  const [objective, setObjective] = useState(initial.objective ?? "");
  const [capital, setCapital] = useState(numToInput(initial.investableCapitalFcfa));
  const [risk, setRisk] = useState(numToInput(initial.riskPerPositionPct));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const derived = useMemo(
    () =>
      riskPercentForProfile({
        age: age === "" ? null : Number(age),
        horizon: (horizon || null) as InvestorHorizon | null,
        capacity: (capacity || null) as InvestorCapacity | null,
        lossTolerance: (loss || null) as InvestorLossTolerance | null,
        objective: (objective || null) as InvestorObjective | null,
        portfolioType: initial.portfolioType,
        investableCapitalFcfa: null,
        riskPerPositionPct: null,
      }),
    [age, horizon, capacity, loss, objective, initial.portfolioType]
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    const res = await fetch("/api/auth/investor-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        age: age === "" ? null : Number(age),
        horizon: horizon || null,
        capacity: capacity || null,
        lossTolerance: loss || null,
        objective: objective || null,
        investableCapitalFcfa: capital === "" ? null : Number(capital),
        riskPerPositionPct: risk === "" ? null : Number(risk),
      }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(messageFromAuthJson(json, t, t("auth.profile.investorFailed")));
      return;
    }
    setMessage(t("auth.profile.investorSaved"));
    router.refresh();
  }

  return (
    <section className={`ob-card ob-card-pad ${profileStyles.card} ${profileStyles.span}`}>
      <h2 className={profileStyles.sectionTitle}>{t("auth.profile.investorTitle")}</h2>
      <p className={profileStyles.meta}>{t("auth.profile.investorLead")}</p>
      {!tableReady ? (
        <p className={profileStyles.meta} role="status">
          {t("auth.profile.investorMigration")}
        </p>
      ) : null}
      <form className={styles.form} onSubmit={(event) => void save(event)}>
        <div className={profileStyles.fields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="investor-age">
              {t("auth.profile.age")}
            </label>
            <input
              id="investor-age"
              className={styles.input}
              inputMode="numeric"
              min={18}
              max={100}
              value={age}
              disabled={!tableReady}
              onChange={(event) => setAge(event.target.value)}
            />
          </div>
          <Select
            id="investor-horizon"
            label={t("auth.profile.horizon")}
            value={horizon}
            disabled={!tableReady}
            unset={t("auth.profile.unset")}
            options={INVESTOR_HORIZONS.map((id) => ({ id, label: t(`auth.profile.horizons.${id}`) }))}
            onChange={setHorizon}
          />
          <Select
            id="investor-capacity"
            label={t("auth.profile.capacity")}
            value={capacity}
            disabled={!tableReady}
            unset={t("auth.profile.unset")}
            options={INVESTOR_CAPACITIES.map((id) => ({ id, label: t(`auth.profile.capacities.${id}`) }))}
            onChange={setCapacity}
          />
          <Select
            id="investor-loss"
            label={t("auth.profile.loss")}
            value={loss}
            disabled={!tableReady}
            unset={t("auth.profile.unset")}
            options={INVESTOR_LOSS_TOLERANCES.map((id) => ({ id, label: t(`auth.profile.losses.${id}`) }))}
            onChange={setLoss}
          />
          <Select
            id="investor-objective"
            label={t("auth.profile.objective")}
            value={objective}
            disabled={!tableReady}
            unset={t("auth.profile.unset")}
            options={INVESTOR_OBJECTIVES.map((id) => ({ id, label: t(`auth.profile.objectives.${id}`) }))}
            onChange={setObjective}
          />
          <div className={styles.field}>
            <label className={styles.label} htmlFor="investor-capital">
              {t("auth.profile.capital")}
            </label>
            <input
              id="investor-capital"
              className={styles.input}
              inputMode="decimal"
              value={capital}
              disabled={!tableReady}
              onChange={(event) => setCapital(event.target.value)}
            />
            <p className={profileStyles.meta}>{t("auth.profile.capitalHint")}</p>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="investor-risk">
              {t("auth.profile.risk")}
            </label>
            <input
              id="investor-risk"
              className={styles.input}
              inputMode="decimal"
              min={0.5}
              max={2}
              step={0.1}
              value={risk}
              disabled={!tableReady}
              onChange={(event) => setRisk(event.target.value)}
            />
            <p className={profileStyles.meta}>{t("auth.profile.riskHint")}</p>
            {risk === "" ? (
              <p className={profileStyles.meta}>{t("auth.profile.derivedRisk", { percent: derived.percent })}</p>
            ) : null}
          </div>
        </div>
        {error ? (
          <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
            {error}
          </div>
        ) : null}
        {message ? (
          <div role="status" className={`${styles.alert} ${styles.alertOk}`}>
            {message}
          </div>
        ) : null}
        <button type="submit" className={styles.submit} disabled={saving || !tableReady}>
          {saving ? t("auth.saving") : t("auth.profile.investorSave")}
        </button>
      </form>
    </section>
  );
}

function Select({
  id,
  label,
  value,
  unset,
  options,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  unset: string;
  options: Array<{ id: string; label: string }>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <select id={id} className={styles.input} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{unset}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
