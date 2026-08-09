"use client";

// Formulaire d'ajout de position — étape 10. Appelle
// POST /api/portfolio/:portfolioId/holdings (déjà existant depuis l'étape 7,
// validé de bout en bout contre une vraie base le 09/08/2026 — cf. AGENTS.md).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/theme/colors";

interface AddHoldingFormProps {
  portfolioId: string;
  tickers: string[];
}

const inputStyle: React.CSSProperties = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: "8px 10px",
  color: C.text,
  fontSize: "0.82rem",
  fontFamily: "inherit",
};

export default function AddHoldingForm({ portfolioId, tickers }: AddHoldingFormProps) {
  const router = useRouter();
  const [ticker, setTicker] = useState(tickers[0] ?? "");
  const [quantity, setQuantity] = useState("");
  const [avgBuyPrice, setAvgBuyPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/portfolio/${portfolioId}/holdings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, quantity: Number(quantity), avgBuyPrice: Number(avgBuyPrice) }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error ?? "Impossible d'ajouter cette position.");
      return;
    }
    setQuantity("");
    setAvgBuyPrice("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
      <div>
        <label style={{ display: "block", fontSize: "0.7rem", color: C.textDim, marginBottom: 4 }}>Société</label>
        <select value={ticker} onChange={(e) => setTicker(e.target.value)} style={inputStyle}>
          {tickers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: "0.7rem", color: C.textDim, marginBottom: 4 }}>Quantité</label>
        <input
          type="number"
          min={1}
          step="1"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          style={{ ...inputStyle, width: 90 }}
        />
      </div>
      <div>
        <label style={{ display: "block", fontSize: "0.7rem", color: C.textDim, marginBottom: 4 }}>Prix d&apos;achat (FCFA)</label>
        <input
          type="number"
          min={1}
          step="1"
          required
          value={avgBuyPrice}
          onChange={(e) => setAvgBuyPrice(e.target.value)}
          style={{ ...inputStyle, width: 120 }}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !ticker}
        style={{
          background: C.green,
          color: "#080B12",
          border: "none",
          borderRadius: 6,
          padding: "9px 14px",
          fontWeight: 700,
          fontSize: "0.8rem",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Ajout…" : "+ Ajouter"}
      </button>
      {error && (
        <div role="alert" style={{ color: C.red, fontSize: "0.78rem", width: "100%" }}>
          {error}
        </div>
      )}
    </form>
  );
}
