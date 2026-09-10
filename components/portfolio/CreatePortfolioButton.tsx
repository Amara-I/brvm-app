"use client";

// Bouton "Nouveau portefeuille" + popup de confirmation.

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/theme/colors";
import { notifyPortfolioChanged } from "@/lib/api/portfolio-trades-client";

type Props = {
  onCreated?: () => void | Promise<void>;
};

type SuccessInfo = {
  id: string;
  name: string;
};

export default function CreatePortfolioButton({ onCreated }: Props) {
  const router = useRouter();
  const titleId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  useEffect(() => {
    if (!success) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSuccess(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [success]);

  async function handleClick() {
    if (loading) return;

    const suggested = `Portefeuille ${new Date().toLocaleDateString("fr-FR")}`;
    const nameRaw = window.prompt("Nom du nouveau portefeuille :", suggested);
    if (nameRaw == null) return;
    const name = nameRaw.trim() || suggested;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(
          json?.error ??
            (res.status === 401
              ? "Session expirée — reconnectez-vous."
              : `Impossible de créer le portefeuille (${res.status}).`)
        );
        return;
      }
      const createdId =
        typeof json.data?.portfolio?.id === "string" ? json.data.portfolio.id : "";
      const createdName =
        typeof json.data?.portfolio?.name === "string" ? json.data.portfolio.name : name;
      notifyPortfolioChanged(createdId || undefined);
      if (onCreated) await onCreated();
      router.refresh();
      setSuccess({ id: createdId, name: createdName });
    } catch {
      setError("Impossible de créer le portefeuille (réseau).");
    } finally {
      setLoading(false);
    }
  }

  function scrollToCreated() {
    if (!success?.id) {
      setSuccess(null);
      return;
    }
    const el = document.getElementById(`portfolio-${success.id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("portfolio-flash");
      window.setTimeout(() => el.classList.remove("portfolio-flash"), 1800);
    }
    setSuccess(null);
  }

  return (
    <>
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={loading}
          style={{
            background: C.gold,
            color: "#080B12",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontWeight: 700,
            fontSize: "0.82rem",
            fontFamily: "inherit",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Création…" : "+ Nouveau portefeuille"}
        </button>
        {error ? (
          <span role="alert" style={{ color: C.red, fontSize: "0.72rem", fontWeight: 600 }}>
            {error}
          </span>
        ) : null}
      </div>

      {success ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(8, 11, 18, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSuccess(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={{
              width: "min(420px, 100%)",
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: "20px 20px 16px",
              boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id={titleId}
              style={{
                margin: "0 0 10px",
                fontSize: "1.05rem",
                color: C.gold,
                fontFamily: "inherit",
              }}
            >
              Portefeuille créé
            </h2>
            <p style={{ margin: "0 0 8px", color: C.text, fontSize: "0.9rem", lineHeight: 1.45 }}>
              « <strong>{success.name}</strong> » a été créé avec succès.
            </p>
            <p style={{ margin: "0 0 16px", color: C.textDim, fontSize: "0.82rem", lineHeight: 1.45 }}>
              Vous le trouverez sur cette page <strong>/portefeuille</strong>, dans la liste ci-dessous
              (panneau portant ce nom). Utilisez « Renommer » ou « Supprimer » sur son en-tête pour le gérer.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSuccess(null)}
                style={{
                  background: C.bg,
                  color: C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={scrollToCreated}
                style={{
                  background: C.gold,
                  color: "#080B12",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Voir le portefeuille
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
