"use client";

import { useState } from "react";
import { C } from "@/lib/theme/colors";
import { notifyPortfolioChanged } from "@/lib/api/portfolio-trades-client";

type Props = {
  portfolioId: string;
  name: string;
  onChanged?: () => void | Promise<void>;
};

export default function PortfolioManageBar({ portfolioId, name, onChanged }: Props) {
  const [busy, setBusy] = useState<"rename" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rename() {
    if (busy) return;
    const next = window.prompt("Nouveau nom du portefeuille :", name);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === name) return;

    setBusy("rename");
    setError(null);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ portfolioId, name: trimmed }),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Renommage impossible.");
        return;
      }
      notifyPortfolioChanged(portfolioId);
      if (onChanged) await onChanged();
    } catch {
      setError("Renommage impossible (réseau).");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (busy) return;
    const ok = window.confirm(
      `Supprimer définitivement « ${name} » ?\n\nToutes les positions et l'historique de ce portefeuille seront effacés.`
    );
    if (!ok) return;

    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/${portfolioId}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Suppression impossible.");
        return;
      }
      notifyPortfolioChanged(portfolioId);
      if (onChanged) await onChanged();
    } catch {
      setError("Suppression impossible (réseau).");
    } finally {
      setBusy(null);
    }
  }

  const btnStyle = {
    background: C.bg,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: "0.72rem",
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: busy ? ("not-allowed" as const) : ("pointer" as const),
    opacity: busy ? 0.65 : 1,
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <button type="button" style={btnStyle} disabled={busy != null} onClick={() => void rename()}>
        {busy === "rename" ? "…" : "Renommer"}
      </button>
      <button
        type="button"
        style={{ ...btnStyle, color: C.red, borderColor: `${C.red}66` }}
        disabled={busy != null}
        onClick={() => void remove()}
      >
        {busy === "delete" ? "…" : "Supprimer"}
      </button>
      {error ? (
        <span role="alert" style={{ color: C.red, fontSize: "0.72rem", fontWeight: 600 }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
