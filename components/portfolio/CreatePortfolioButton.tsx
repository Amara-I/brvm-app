"use client";

// Bouton "Nouveau portefeuille" — étape 10. Appelle POST /api/portfolio
// (déjà existant depuis l'étape 7) puis rafraîchit la page serveur.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/theme/colors";

export default function CreatePortfolioButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        background: C.gold,
        color: "#080B12",
        border: "none",
        borderRadius: 6,
        padding: "8px 16px",
        fontWeight: 700,
        fontSize: "0.82rem",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "Création…" : "+ Nouveau portefeuille"}
    </button>
  );
}
