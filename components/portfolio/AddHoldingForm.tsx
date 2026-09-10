"use client";

// Formulaire d'ajout de position — étape 10 + horizon d'achat.

import { useState } from "react";
import { C } from "@/lib/theme/colors";
import { notifyPortfolioChanged } from "@/lib/api/portfolio-trades-client";
import EducationTermLink from "@/components/education/EducationTermLink";

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
  const [ticker, setTicker] = useState(tickers[0] ?? "");
  const [quantity, setQuantity] = useState("");
  const [avgBuyPrice, setAvgBuyPrice] = useState("");
  const [buyHorizon, setBuyHorizon] = useState<"COURT" | "MOYEN" | "LONG">("MOYEN");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/portfolio/${portfolioId}/holdings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker,
        quantity: Number(quantity),
        avgBuyPrice: Number(avgBuyPrice),
        buyDate: today,
        buyHorizon,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error ?? "Impossible d'ajouter cette position.");
      return;
    }
    setQuantity("");
    setAvgBuyPrice("");
    setBuyHorizon("MOYEN");
    notifyPortfolioChanged(portfolioId);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}
    >
      <div>
        <label style={{ display: "block", fontSize: "0.7rem", color: C.textDim, marginBottom: 4 }}>
          Société
        </label>
        <select value={ticker} onChange={(e) => setTicker(e.target.value)} style={inputStyle}>
          {tickers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: "0.7rem", color: C.textDim, marginBottom: 4 }}>
          Quantité
        </label>
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
        <label style={{ display: "block", fontSize: "0.7rem", color: C.textDim, marginBottom: 4 }}>
          <EducationTermLink slug="pru">Prix d&apos;achat / PRU (FCFA)</EducationTermLink>
        </label>
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
      <div>
        <label style={{ display: "block", fontSize: "0.7rem", color: C.textDim, marginBottom: 4 }}>
          <EducationTermLink slug="horizon-d-achat">Horizon d&apos;achat</EducationTermLink>
        </label>
        <select
          value={buyHorizon}
          onChange={(e) => setBuyHorizon(e.target.value as "COURT" | "MOYEN" | "LONG")}
          style={inputStyle}
          aria-label="Horizon d'achat"
        >
          <option value="COURT">Court terme</option>
          <option value="MOYEN">Moyen terme</option>
          <option value="LONG">Long terme</option>
        </select>
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
        {loading ? "Ajout…" : "+ Ajouter / renforcer"}
      </button>
      {error && (
        <div role="alert" style={{ color: C.red, fontSize: "0.78rem", width: "100%" }}>
          {error}
        </div>
      )}
    </form>
  );
}
