"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import PasswordField from "@/components/auth/PasswordField";
import styles from "@/components/auth/AuthForm.module.css";
import profileStyles from "./Profile.module.css";
import PortfolioTypePicker from "./PortfolioTypePicker";
import { parsePortfolioType, type PortfolioTypeId } from "@/lib/portfolio/types";

export type ProfilePayload = {
  name: string | null;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  isAdmin: boolean;
  portfolioType: PortfolioTypeId | null;
};

export default function ProfileClient({
  initial,
  mailNotice,
}: {
  initial: ProfilePayload;
  mailNotice?: string | null;
}) {
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
    initial.portfolioType
  );
  const [typeMsg, setTypeMsg] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileMsg(null);
    setSavingProfile(true);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, email }),
    });
    const json = await res.json().catch(() => null);
    setSavingProfile(false);
    if (!res.ok) {
      setProfileError(json?.error ?? "La mise à jour a échoué.");
      return;
    }
    if (typeof json?.data?.mailError === "string") {
      setProfileError(json.data.mailError);
    } else {
      setProfileMsg(json?.data?.emailVerified === false && email !== initial.email
        ? "Profil mis à jour. Un email de confirmation a été envoyé à la nouvelle adresse."
        : "Profil mis à jour.");
    }
    router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("Les deux mots de passe ne correspondent pas.");
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
      setPasswordError(json?.error ?? "Le mot de passe n'a pas pu être modifié.");
      return;
    }
    setPasswordMsg("Mot de passe mis à jour.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function savePortfolioType(e: React.FormEvent) {
    e.preventDefault();
    setTypeError(null);
    setTypeMsg(null);
    if (!portfolioType) {
      setTypeError("Choisissez un type parmi les quatre cadres.");
      return;
    }
    setSavingType(true);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolioType }),
    });
    const json = await res.json().catch(() => null);
    setSavingType(false);
    if (!res.ok) {
      setTypeError(json?.error ?? "L’enregistrement du type a échoué.");
      return;
    }
    setPortfolioType(parsePortfolioType(json?.data?.portfolioType) ?? portfolioType);
    setTypeMsg("Type de portefeuille enregistré. Analyses et Simulations s’en serviront comme lecture par défaut.");
    router.refresh();
  }

  return (
    <div className={profileStyles.grid}>
      <section className={`ob-card ob-card-pad ${profileStyles.card} ${profileStyles.full}`}>
        <h2 className={profileStyles.sectionTitle}>Type de portefeuille</h2>
        <p className={profileStyles.meta}>
          Cadre pédagogique principal (Croissance, Rente, Trading, Croissance Max). Il oriente les
          rappels sur les fiches, le marché et les simulations — sans modifier les scores calculés.
        </p>
        <form className={styles.form} onSubmit={(e) => void savePortfolioType(e)}>
          <PortfolioTypePicker value={portfolioType} onChange={setPortfolioType} />
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
          <button type="submit" className={styles.submit} disabled={savingType || !portfolioType}>
            {savingType ? "Enregistrement…" : "Enregistrer le type"}
          </button>
        </form>
      </section>

      <section className={`ob-card ob-card-pad ${profileStyles.card}`}>
        <h2 className={profileStyles.sectionTitle}>Identité</h2>
        <p className={profileStyles.meta}>
          Statut email :{" "}
          <strong className={initial.emailVerified ? profileStyles.ok : profileStyles.warn}>
            {initial.emailVerified ? "Confirmée" : "Non confirmée"}
          </strong>
        </p>
        <form className={styles.form} onSubmit={(e) => void saveProfile(e)}>
          <div className={styles.field}>
            <label htmlFor="profile-name" className={styles.label}>
              Nom
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
              Adresse email
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
            {savingProfile ? "Enregistrement…" : "Enregistrer le profil"}
          </button>
        </form>
      </section>

      <section className={`ob-card ob-card-pad ${profileStyles.card}`}>
        <h2 className={profileStyles.sectionTitle}>Mot de passe</h2>
        <p className={profileStyles.meta}>
          {initial.hasPassword
            ? "Modifiez le mot de passe utilisé pour la connexion email."
            : "Compte Google : vous pouvez aussi définir un mot de passe pour vous connecter par email."}
        </p>
        <form className={styles.form} onSubmit={(e) => void savePassword(e)}>
          {initial.hasPassword ? (
            <PasswordField
              id="current-password"
              label="Mot de passe actuel"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
          ) : null}
          <PasswordField
            id="new-password"
            label={`Nouveau mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum)`}
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
          />
          <PasswordField
            id="confirm-password"
            label="Confirmer le nouveau mot de passe"
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
            {savingPassword ? "Enregistrement…" : initial.hasPassword ? "Changer le mot de passe" : "Définir un mot de passe"}
          </button>
        </form>
      </section>

      {initial.isAdmin ? (
        <section className={`ob-card ob-card-pad ${profileStyles.card}`}>
          <h2 className={profileStyles.sectionTitle}>Administration</h2>
          <p className={profileStyles.meta}>Votre compte a le rôle administrateur.</p>
          <Link href="/admin/analytics" className={styles.inlineLink}>
            Ouvrir l’analytique
          </Link>
        </section>
      ) : null}
    </div>
  );
}
