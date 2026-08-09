"use client";

// Table du Screener — étape 10 (navigation complète).
// Filtres rapides façon Ouestbourse (Rentabilité / Dividendes / Croissance /
// Valorisation), demandés dans le brief initial du projet. Les métriques
// (`score`, `dividendYieldPercent`, `perf5Percent`, `per`) sont calculées
// côté serveur via `calcMetrics` (MÊME fonction que `/marche` et l'export
// Excel) — ce composant ne fait que trier/filtrer, aucun nouveau calcul
// métier n'est introduit ici.

import { useMemo, useState } from "react";
import Link from "next/link";
import { C } from "@/lib/theme/colors";
import type { CompanyWithMetrics } from "@/lib/calc/market-summary-stats";

type FilterKey = "rentabilite" | "dividendes" | "croissance" | "valorisation";

const FILTERS: Array<{ key: FilterKey; label: string; icon: string }> = [
  { key: "rentabilite", label: "Rentabilité", icon: "🏆" },
  { key: "dividendes", label: "Dividendes", icon: "💰" },
  { key: "croissance", label: "Croissance", icon: "📈" },
  { key: "valorisation", label: "Valorisation", icon: "⚖️" },
];

function num(v: string | number): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isNaN(n) ? -Infinity : n;
}

export default function ScreenerTable({ companies }: { companies: CompanyWithMetrics[] }) {
  const [active, setActive] = useState<FilterKey>("rentabilite");

  const sorted = useMemo(() => {
    const list = [...companies];
    switch (active) {
      case "rentabilite":
        return list.sort((a, b) => b.metrics.score - a.metrics.score);
      case "dividendes":
        return list.sort((a, b) => num(b.metrics.dividendYieldPercent) - num(a.metrics.dividendYieldPercent));
      case "croissance":
        return list.sort((a, b) => num(b.metrics.perf5Percent) - num(a.metrics.perf5Percent));
      case "valorisation":
        return list
          .filter((c) => c.co.per > 0)
          .sort((a, b) => a.co.per - b.co.per);
      default:
        return list;
    }
  }, [companies, active]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActive(f.key)}
            aria-pressed={active === f.key}
            style={{
              background: active === f.key ? C.gold : C.panel,
              color: active === f.key ? "#080B12" : C.text,
              border: `1px solid ${active === f.key ? C.gold : C.border}`,
              borderRadius: 20,
              padding: "8px 16px",
              fontSize: "0.82rem",
              fontWeight: active === f.key ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ color: C.textDim, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>
              <th scope="col" style={{ padding: "8px 6px" }}>Société</th>
              <th scope="col" style={{ padding: "8px 6px" }}>Secteur</th>
              <th scope="col" style={{ padding: "8px 6px" }}>Score</th>
              <th scope="col" style={{ padding: "8px 6px" }}>Perf. 5 ans</th>
              <th scope="col" style={{ padding: "8px 6px" }}>Rend. dividende</th>
              <th scope="col" style={{ padding: "8px 6px" }}>PER</th>
              <th scope="col" style={{ padding: "8px 6px" }}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ co, metrics }) => (
              <tr key={co.ticker} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "8px 6px", color: C.text }}>
                  <Link href={`/marche?ticker=${co.ticker}`} style={{ color: C.text, textDecoration: "none" }}>
                    {co.countryFlag} <strong>{co.ticker}</strong> — {co.name}
                  </Link>
                </td>
                <td style={{ padding: "8px 6px", color: C.textDim }}>{co.sector}</td>
                <td style={{ padding: "8px 6px", color: C.blue, fontWeight: 700 }}>{metrics.score}</td>
                <td style={{ padding: "8px 6px", color: num(metrics.perf5Percent) >= 0 ? C.green : C.red }}>
                  {metrics.perf5Percent !== "N/D" ? `${num(metrics.perf5Percent) >= 0 ? "+" : ""}${metrics.perf5Percent}%` : "N/D"}
                </td>
                <td style={{ padding: "8px 6px", color: C.teal }}>{metrics.dividendYieldPercent}%</td>
                <td style={{ padding: "8px 6px", color: C.text }}>{co.per > 0 ? co.per.toFixed(1) : "N/D"}</td>
                <td style={{ padding: "8px 6px" }}>
                  <span style={{ color: metrics.signal.color, fontWeight: 700, fontSize: "0.72rem" }}>{metrics.signal.label}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
