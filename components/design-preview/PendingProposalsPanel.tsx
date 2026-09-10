"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { C } from "@/lib/theme/colors";
import type { PendingDesignProposal } from "@/lib/design-agent/list-pending-proposals";

export default function PendingProposalsPanel({
  items,
  isAuthenticated,
}: {
  items: PendingDesignProposal[];
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(findingId: string, status: "RETENU" | "REJETE") {
    setBusyId(findingId);
    setError(null);
    try {
      const res = await fetch(`/api/research/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Action impossible.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <section
        style={{
          margin: "0 0 28px",
          padding: 16,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.panel,
        }}
      >
        <h2 style={{ margin: "0 0 6px", fontSize: "1rem", color: C.gold }}>
          Propositions en attente
        </h2>
        <p style={{ margin: 0, fontSize: "0.82rem", color: C.textDim }}>
          Aucune proposition ouverte pour le moment. La veille quotidienne (6h UTC) en crée
          automatiquement lorsque de nouveaux patterns DESIGN/UX sont détectés.
        </p>
      </section>
    );
  }

  return (
    <section
      style={{
        margin: "0 0 28px",
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: C.panel,
      }}
    >
      <h2 style={{ margin: "0 0 6px", fontSize: "1rem", color: C.gold }}>
        Propositions en attente ({items.length})
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: "0.82rem", color: C.textDim }}>
        Validez (retenir) ou rejetez chaque piste. Les retenues pourront être implémentées sur
        demande explicite en chat.
      </p>
      {error && (
        <p style={{ color: C.red, fontSize: "0.78rem" }} role="alert">
          {error}
        </p>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((p) => (
          <li
            key={p.id}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 12,
              background: C.bg,
            }}
          >
            <div style={{ fontSize: "0.72rem", color: C.textDim, marginBottom: 4 }}>
              {p.id} · {p.date} · {p.source === "file" ? "fichier" : "veille"}
            </div>
            <div style={{ fontWeight: 700, color: C.text, fontSize: "0.9rem" }}>{p.title}</div>
            {p.summary && (
              <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: C.textDim }}>{p.summary}</p>
            )}
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: 6, fontSize: "0.72rem", color: C.teal }}
              >
                Source →
              </a>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {p.findingId ? (
                isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === p.findingId}
                      onClick={() => void setStatus(p.findingId!, "RETENU")}
                      style={btnOk}
                    >
                      Retenir
                    </button>
                    <button
                      type="button"
                      disabled={busyId === p.findingId}
                      onClick={() => void setStatus(p.findingId!, "REJETE")}
                      style={btnNo}
                    >
                      Rejeter
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: C.textDim }}>
                    Connectez-vous pour valider ou rejeter.
                  </span>
                )
              ) : (
                <span style={{ fontSize: "0.75rem", color: C.textDim }}>
                  Fichier Markdown — indiquez l&apos;ID en chat pour appliquer ou rejeter.
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const btnOk: React.CSSProperties = {
  background: C.green,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: "0.78rem",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnNo: React.CSSProperties = {
  background: "transparent",
  color: C.red,
  border: `1px solid ${C.red}`,
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: "0.78rem",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
