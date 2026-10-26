"use client";

import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/theme/colors";
import { useI18n } from "@/components/i18n/I18nProvider";
import { discreteMaskLabel } from "@/components/portfolio/portfolio-i18n";
import {
  DEFAULT_DISCRETE_MASKS,
  DISCRETE_MASK_KEYS,
  type DiscreteMaskConfig,
  type DiscreteMaskKey,
} from "@/lib/portfolio/discrete-mode";

type Props = {
  discrete: boolean;
  onDiscreteChange: (next: boolean) => void;
  masks: DiscreteMaskConfig;
  onMasksChange: (next: DiscreteMaskConfig) => void;
};

export default function PortfolioDiscreteControls({
  discrete,
  onDiscreteChange,
  masks,
  onMasksChange,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  function toggleMask(key: DiscreteMaskKey) {
    onMasksChange({ ...masks, [key]: !masks[key] });
  }

  return (
    <div
      ref={rootRef}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        position: "relative",
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => onDiscreteChange(!discrete)}
          aria-pressed={discrete}
          title={discrete ? t("portfolio.discrete.onTitle") : t("portfolio.discrete.offTitle")}
          style={{
            background: discrete ? C.gold : C.bg,
            color: discrete ? "#080b12" : C.text,
            border: `1px solid ${discrete ? C.gold : C.border}`,
            borderRadius: 999,
            padding: "8px 14px",
            fontSize: "0.78rem",
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {discrete ? t("portfolio.discrete.on") : t("portfolio.discrete.off")}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={t("portfolio.discrete.chooseTitle")}
          style={{
            background: C.bg,
            color: C.text,
            border: `1px solid ${open ? C.gold : C.border}`,
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: "0.78rem",
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {t("portfolio.discrete.choose")}
        </button>
      </div>
      {discrete ? (
        <p
          style={{
            margin: 0,
            maxWidth: 280,
            color: C.textDim,
            fontSize: "0.72rem",
            lineHeight: 1.35,
          }}
        >
          {t("portfolio.discrete.active")}
        </p>
      ) : null}
      {open ? (
        <div
          role="dialog"
          aria-label={t("portfolio.discrete.dialog")}
          style={{
            position: "absolute",
            left: 0,
            top: "calc(100% + 8px)",
            zIndex: 40,
            width: "min(320px, 92vw)",
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 14px",
            boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
          }}
        >
          <p style={{ margin: "0 0 10px", fontSize: "0.78rem", color: C.textDim, lineHeight: 1.4 }}>
            {t("portfolio.discrete.help")}
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {DISCRETE_MASK_KEYS.map((key) => (
              <li key={key}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: "0.82rem",
                    color: C.text,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={masks[key]}
                    onChange={() => toggleMask(key)}
                  />
                  <span>{discreteMaskLabel(key, t)}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onMasksChange({ ...DEFAULT_DISCRETE_MASKS })}
            style={{
              marginTop: 12,
              width: "100%",
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "7px 10px",
              color: C.textDim,
              fontSize: "0.75rem",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {t("portfolio.discrete.reset")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
