"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TFunc } from "@/lib/i18n/create-i18n";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { isPlausibleEmail, messageFromAuthJson } from "@/components/auth/api-message";
import PasswordField from "@/components/auth/PasswordField";
import styles from "@/components/auth/AuthForm.module.css";
import profileStyles from "./Profile.module.css";
import {
  PORTFOLIO_TYPE_LIST,
  writeStoredPortfolioType,
  type PortfolioTypeId,
} from "@/lib/portfolio-types";

function portfolioTypeCopy(id: PortfolioTypeId, t: TFunc) {
  switch (id) {
    case "CROISSANCE":
      return {
        label: t("auth.profile.types.croissance.label"),
        horizon: t("auth.profile.types.croissance.horizon"),
        risk: t("auth.profile.types.croissance.risk"),
        tagline: t("auth.profile.types.croissance.tagline"),
      };
    case "RENTE":
      return {
        label: t("auth.profile.types.rente.label"),
        horizon: t("auth.profile.types.rente.horizon"),
        risk: t("auth.profile.types.rente.risk"),
        tagline: t("auth.profile.types.rente.tagline"),
      };
    case "TRADING":
      return {
        label: t("auth.profile.types.trading.label"),
        horizon: t("auth.profile.types.trading.horizon"),
        risk: t("auth.profile.types.trading.risk"),
        tagline: t("auth.profile.types.trading.tagline"),
      };
    case "CROISSANCE_MAX":
      return {
        label: t("auth.profile.types.croissanceMax.label"),
        horizon: t("auth.profile.types.croissanceMax.horizon"),
        risk: t("auth.profile.types.croissanceMax.risk"),
        tagline: t("auth.profile.types.croissanceMax.tagline"),
      };
  }
}

export type ProfilePayload = {
  name: string | null;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  isAdmin: boolean;
  preferredPortfolioType: PortfolioTypeId | null;
};

export default function ProfileClient({
  initial,
  mailNotice,
}: {
  initial: ProfilePayload;
  mailNotice?: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState(initial.name ?? "");
  const [email, setEmail] = useState(initial.email);
  const [profileMsg, setProfileMsg] = useState<string | null>(mailNotice ?? null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [portfolioType, setPortfolioType] = useState<PortfolioTypeId | null>(
    initial.preferredPortfolioType
  );
  const [typeMsg, setTypeMsg] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileMsg(null);
    if (!isPlausibleEmail(email)) {
      setProfileError(t("auth.invalidEmail"));
      return;
    }
    setSavingProfile(true);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, email }),
    });
    const json = await res.json().catch(() => null);
    setSavingProfile(false);
    if (!res.ok) {
      setProfileError(messageFromAuthJson(json, t, t("auth.profile.updateFailed")));
      return;
    }
    if (typeof json?.data?.mailError === "string") {
      setProfileError(json.data.mailError);
    } else {
      setProfileMsg(
        json?.data?.emailVerified === false && email !== initial.email
          ? t("auth.profile.updatedEmail")
          : t("auth.profile.updated")
      );
    }
    router.refresh();
  }

  async function savePortfolioType(next: PortfolioTypeId) {
    setTypeError(null);
    setTypeMsg(null);
    setSavingType(true);
    setPortfolioType(next);
    writeStoredPortfolioType(next);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredPortfolioType: next }),
    });
    const json = await res.json().catch(() => null);
    setSavingType(false);
    if (!res.ok) {
      setTypeError(messageFromAuthJson(json, t, t("auth.profile.typeFailed")));
      return;
    }
    setTypeMsg(t("auth.profile.typeSaved"));
    router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMsg(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t("auth.passwordMin", { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("auth.passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: initial.hasPassword ? currentPassword : undefined,
        newPassword,
      }),
    });
    const json = await res.json().catch(() => null);
    setSavingPassword(false);
    if (!res.ok) {
      setPasswordError(messageFromAuthJson(json, t, t("auth.profile.passwordFailed")));
      return;
    }
    setPasswordMsg(t("auth.profile.passwordUpdated"));
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className={profileStyles.grid}>
      <section className={`ob-card ob-card-pad ${profileStyles.card}`}>
        <h2 className={profileStyles.sectionTitle}>{t("auth.profile.identity")}</h2>
        <p className={profileStyles.meta}>
          {t("auth.profile.emailStatus")}{" "}
          <strong className={initial.emailVerified ? profileStyles.ok : profileStyles.warn}>
            {initial.emailVerified ? t("auth.profile.confirmed") : t("auth.profile.unconfirmed")}
          </strong>
        </p>
        <form className={styles.form} onSubmit={(e) => void saveProfile(e)}>
          <div className={styles.field}>
            <label htmlFor="profile-name" className={styles.label}>
              {t("auth.profile.name")}
            </label>
            <input
              id="profile-name"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="profile-email" className={styles.label}>
              {t("auth.email")}
            </label>
            <input
              id="profile-email"
              className={styles.input}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {profileError ? (
            <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
              {profileError}
            </div>
          ) : null}
          {profileMsg ? (
            <div role="status" className={`${styles.alert} ${styles.alertOk}`}>
              {profileMsg}
            </div>
          ) : null}
          <button type="submit" className={styles.submit} disabled={savingProfile}>
            {savingProfile ? t("auth.saving") : t("auth.profile.save")}
          </button>
        </form>
      </section>

      <section className={`ob-card ob-card-pad ${profileStyles.card}`}>
        <h2 className={profileStyles.sectionTitle}>{t("auth.profile.preferredTitle")}</h2>
        <p className={profileStyles.meta}>
          {t("auth.profile.preferredLead")}{" "}
          <Link href="/education/types-de-portefeuille" className={styles.inlineLink}>
            {t("auth.profile.readTypes")}
          </Link>
        </p>
        <div className={profileStyles.typeGrid} role="radiogroup" aria-label={t("auth.profile.preferredTitle")}>
          {PORTFOLIO_TYPE_LIST.map((d) => {
            const selected = portfolioType === d.id;
            const copy = portfolioTypeCopy(d.id, t);
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? profileStyles.typeCardOn : profileStyles.typeCard}
                disabled={savingType}
                onClick={() => void savePortfolioType(d.id)}
              >
                <strong>{copy.label}</strong>
                <span>{t("auth.profile.typeMeta", { horizon: copy.horizon, risk: copy.risk })}</span>
                <span>{copy.tagline}</span>
              </button>
            );
          })}
        </div>
        {typeError ? (
          <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
            {typeError}
          </div>
        ) : null}
        {typeMsg ? (
          <div role="status" className={`${styles.alert} ${styles.alertOk}`}>
            {typeMsg}
          </div>
        ) : null}
      </section>

      <section className={`ob-card ob-card-pad ${profileStyles.card}`}>
        <h2 className={profileStyles.sectionTitle}>{t("auth.profile.passwordTitle")}</h2>
        <p className={profileStyles.meta}>
          {initial.hasPassword ? t("auth.profile.passwordHas") : t("auth.profile.passwordGoogle")}
        </p>
        <form className={styles.form} onSubmit={(e) => void savePassword(e)}>
          {initial.hasPassword ? (
            <PasswordField
              id="current-password"
              label={t("auth.profile.currentPassword")}
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
          ) : null}
          <PasswordField
            id="new-password"
            label={t("auth.profile.newPassword", { count: MIN_PASSWORD_LENGTH })}
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
          />
          <PasswordField
            id="confirm-password"
            label={t("auth.profile.confirmPassword")}
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
          />
          {passwordError ? (
            <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
              {passwordError}
            </div>
          ) : null}
          {passwordMsg ? (
            <div role="status" className={`${styles.alert} ${styles.alertOk}`}>
              {passwordMsg}
            </div>
          ) : null}
          <button type="submit" className={styles.submit} disabled={savingPassword}>
            {savingPassword
              ? t("auth.saving")
              : initial.hasPassword
                ? t("auth.profile.changePassword")
                : t("auth.profile.setPassword")}
          </button>
        </form>
      </section>

      {initial.isAdmin ? (
        <section className={`ob-card ob-card-pad ${profileStyles.card}`}>
          <h2 className={profileStyles.sectionTitle}>{t("auth.profile.adminTitle")}</h2>
          <p className={profileStyles.meta}>{t("auth.profile.adminLead")}</p>
          <Link href="/admin/analytics" className={styles.inlineLink}>
            {t("auth.profile.openAnalytics")}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
