"use client";

// Bouton recherche global — à gauche du bascule thème (demande utilisateur).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/theme/colors";
import { IconSearch } from "@/components/icons/HeaderIcons";

export interface HeaderSearchItem {
  ticker: string;
  name: string;
  sector: string;
}

export default function HeaderSearch({ companies }: { companies: HeaderSearchItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return companies.slice(0, 8);
    return companies
      .filter(
        (c) =>
          c.ticker.toLowerCase().includes(needle) ||
          c.name.toLowerCase().includes(needle) ||
          c.sector.toLowerCase().includes(needle)
      )
      .slice(0, 10);
  }, [companies, q]);

  function go(ticker: string) {
    setOpen(false);
    setQ("");
    router.push(`/actions/${ticker}`);
  }

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Rechercher une société"
        aria-expanded={open}
        title="Rechercher"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 8,
          border: `1px solid ${C.border}`,
          background: open ? C.selectedBg : "transparent",
          color: C.text,
          cursor: "pointer",
          fontSize: "1rem",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        <IconSearch size={15} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Recherche sociétés"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "min(20rem, calc(100vw - 2rem))",
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            zIndex: 100,
            padding: 10,
          }}
        >
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ticker ou nom…"
            aria-label="Rechercher une société"
            style={{
              width: "100%",
              boxSizing: "border-box",
              font: "inherit",
              fontSize: "0.85rem",
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.bg,
              color: C.text,
              marginBottom: 8,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) go(results[0].ticker);
            }}
          />
          <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 280, overflowY: "auto" }}>
            {results.length === 0 ? (
              <li style={{ padding: "10px 8px", fontSize: "0.8rem", color: C.textDim }}>Aucun résultat (N/D).</li>
            ) : (
              results.map((c) => (
                <li key={c.ticker}>
                  <button
                    type="button"
                    onClick={() => go(c.ticker)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      color: C.text,
                      cursor: "pointer",
                      padding: "8px 8px",
                      borderRadius: 6,
                      fontFamily: "inherit",
                      fontSize: "0.82rem",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = C.selectedBg;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <strong style={{ color: C.gold }}>{c.ticker}</strong>
                    <span style={{ color: C.textDim }}> · </span>
                    {c.name}
                    <div style={{ fontSize: "0.7rem", color: C.textDim }}>{c.sector}</div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
