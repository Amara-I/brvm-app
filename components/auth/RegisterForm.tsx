"use client";

// Formulaire d'inscription — étape 10 (navigation complète).
// POST /api/auth/register (déjà existant depuis l'étape 7) puis connexion
// automatique via `signIn("credentials", ...)` pour éviter à l'utilisateur
// de retaper ses identifiants juste après inscription.

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, email, password }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json?.error ?? "Une erreur est survenue. Réessayez.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);
    if (result?.error) {
      // Compte créé mais connexion auto échouée (rare) : renvoyer vers la
      // page de connexion plutôt que de bloquer l'utilisateur.
      router.push("/connexion");
      return;
    }
    router.push("/portefeuille");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="name" style={{ display: "block", fontSize: "0.8rem", color: C.textDim, marginBottom: 6 }}>
        Nom (facultatif)
      </label>
      <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

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
        Mot de passe (8 caractères minimum)
      </label>
      <input
        id="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
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
        {loading ? "Création du compte…" : "Créer mon compte"}
      </button>

      <p style={{ textAlign: "center", fontSize: "0.82rem", color: C.textDim, marginTop: 18 }}>
        Déjà un compte ?{" "}
        <Link href="/connexion" style={{ color: C.gold, textDecoration: "underline" }}>
          Se connecter
        </Link>
      </p>
    </form>
  );
}
