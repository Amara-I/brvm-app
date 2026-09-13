"use client";

import { useState, type ReactNode } from "react";
import styles from "./AuthForm.module.css";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  extra?: ReactNode;
};

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  minLength,
  required = true,
  extra,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.field}>
      <div className={extra ? styles.rowBetween : undefined}>
        <label htmlFor={id} className={styles.label} style={extra ? { marginBottom: 0 } : undefined}>
          {label}
        </label>
        {extra}
      </div>
      <div className={styles.passwordWrap}>
        <input
          id={id}
          className={styles.input}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? "Masquer" : "Afficher"}
        </button>
      </div>
    </div>
  );
}
