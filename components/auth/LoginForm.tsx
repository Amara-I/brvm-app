"use client";

// Formulaire de connexion — étape 10 (navigation complète).
// Utilise `signIn("credentials", ...)` de `next-auth/react`, branché sur le
// `CredentialsProvider` déjà configuré depuis l'étape 7
// (`lib/auth/auth-options.ts`) — aucune nouvelle route API nécessaire.

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { C } from "@/lib/theme/colors";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: "10px 12px",
  color: C.text,
  fontSize: "0.9rem",
  fontFamily: "inherit",
  marginBottom: 14,
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/marche";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);
    if (result?.error) {
      setError("Email ou mot de passe incorrect.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="email" style={{ display: "block", fontSize: "0.8rem", color: C.textDim, marginBottom: 6 }}>
        Adresse email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
      />

      <label htmlFor="password" style={{ display: "block", fontSize: "0.8rem", color: C.textDim, marginBottom: 6 }}>
        Mot de passe
      </label>
      <input
        id="password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={inputStyle}
      />

      {error && (
        <div role="alert" style={{ color: C.red, fontSize: "0.82rem", marginBottom: 14 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          background: C.gold,
          color: "#080B12",
          border: "none",
          borderRadius: 6,
          padding: "11px 0",
          fontWeight: 700,
          fontSize: "0.9rem",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Connexion…" : "Se connecter"}
      </button>

      <p style={{ textAlign: "center", fontSize: "0.82rem", color: C.textDim, marginTop: 18 }}>
        Pas encore de compte ?{" "}
        <Link href="/inscription" style={{ color: C.gold, textDecoration: "underline" }}>
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
