"use client";

import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { C } from "@/lib/theme/colors";
import type { TickerAllocation } from "@/lib/calc/portfolio-metrics";
import { DISCRETE_AMOUNT_LABEL } from "@/lib/portfolio/discrete-mode";

const SLICE_COLORS = [
  "#D4A843",
  "#22C55E",
  "#3B82F6",
  "#A855F7",
  "#F97316",
  "#14B8A6",
  "#EF4444",
  "#84CC16",
  "#EC4899",
  "#64748B",
];

const LEGEND_INLINE_MAX = 5;

function fmtPct(n: number): string {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function fmtFcfa(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

type Slice = {
  name: string;
  value: number;
  /** Poids dans le portefeuille entier. */
  portfolioWeightPercent: number;
  /** Poids dans le sous-ensemble affiché (secteur filtré). */
  sliceWeightPercent: number;
  color: string;
};

export default function PortfolioAllocationChart({
  items,
  title = "Répartition par action",
  discrete = false,
}: {
  items: TickerAllocation[];
  title?: string;
  discrete?: boolean;
}) {
  const [sector, setSector] = useState<string>("Tous");
  const [legendPick, setLegendPick] = useState<string>("");

  const sectors = useMemo(() => {
    const set = new Set(items.map((it) => it.sector).filter(Boolean));
    return ["Tous", ...[...set].sort((a, b) => a.localeCompare(b, "fr"))];
  }, [items]);

  const filtered = useMemo(() => {
    if (sector === "Tous") return items;
    return items.filter((it) => it.sector === sector);
  }, [items, sector]);

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, it) => sum + it.value, 0),
    [filtered]
  );

  const data: Slice[] = useMemo(
    () =>
      filtered.map((it, i) => ({
        name: it.ticker,
        value: it.value,
        portfolioWeightPercent: it.weightPercent,
        sliceWeightPercent:
          filteredTotal > 0 ? Math.round((it.value / filteredTotal) * 1000) / 10 : 0,
        color: SLICE_COLORS[i % SLICE_COLORS.length]!,
      })),
    [filtered, filteredTotal]
  );

  const showInlineLegend = data.length > 0 && data.length <= LEGEND_INLINE_MAX;

  if (items.length === 0) {
    return (
      <div style={{ color: C.textDim, fontSize: "0.82rem", padding: "12px 0" }}>
        Ajoutez des positions pour visualiser la diversification.
      </div>
    );
  }

  return (
    <div>
      <div style={{ color: C.gold, fontSize: "0.85rem", fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <p style={{ color: C.textDim, fontSize: "0.75rem", margin: "0 0 10px" }}>
        Poids de chaque titre dans la valeur de marché — utile pour ajuster la diversification.
      </p>

      <label style={{ display: "block", marginBottom: 10 }}>
        <span style={{ color: C.textDim, fontSize: "0.72rem", display: "block", marginBottom: 4 }}>
          Secteur
        </span>
        <select
          value={sector}
          onChange={(e) => {
            setSector(e.target.value);
            setLegendPick("");
          }}
          style={selectStyle}
          aria-label="Filtrer le graphique par secteur"
        >
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      {data.length === 0 ? (
        <p style={{ color: C.textDim, fontSize: "0.78rem" }}>
          Aucune position dans ce secteur.
        </p>
      ) : (
        <>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={112}
                  paddingAngle={1.5}
                  stroke={C.panel}
                  strokeWidth={2}
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, item) => {
                    const payload = item?.payload as Slice | undefined;
                    const v = typeof value === "number" ? value : Number(value);
                    const pct =
                      sector === "Tous"
                        ? payload?.portfolioWeightPercent
                        : payload?.sliceWeightPercent;
                    const ticker = typeof name === "string" ? name : payload?.name ?? "N/D";
                    return [
                      discrete
                        ? `${DISCRETE_AMOUNT_LABEL}${pct != null ? ` · ${fmtPct(pct)}` : ""}`
                        : `${fmtFcfa(Number.isFinite(v) ? v : 0)}${pct != null ? ` · ${fmtPct(pct)}` : ""}`,
                      ticker,
                    ];
                  }}
                  contentStyle={{
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    fontSize: "0.75rem",
                    color: C.text,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {showInlineLegend ? (
            <ul
              style={{
                listStyle: "none",
                margin: "8px 0 0",
                padding: 0,
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 12px",
                justifyContent: "center",
              }}
            >
              {data.map((d) => (
                <li key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: C.text }}>
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: d.color,
                      flexShrink: 0,
                    }}
                  />
                  {d.name} (
                  {fmtPct(sector === "Tous" ? d.portfolioWeightPercent : d.sliceWeightPercent)})
                </li>
              ))}
            </ul>
          ) : (
            <label style={{ display: "block", marginTop: 8 }}>
              <span style={{ color: C.textDim, fontSize: "0.72rem", display: "block", marginBottom: 4 }}>
                Détail d&apos;une position ({data.length} titres)
              </span>
              <select
                value={legendPick}
                onChange={(e) => setLegendPick(e.target.value)}
                style={selectStyle}
                aria-label="Choisir une position pour voir son poids"
              >
                <option value="">Choisir un ticker…</option>
                {data.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              {legendPick
                ? (() => {
                    const row = data.find((d) => d.name === legendPick);
                    if (!row) return null;
                    const pct = sector === "Tous" ? row.portfolioWeightPercent : row.sliceWeightPercent;
                    return (
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: "0.78rem",
                          color: C.text,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: row.color,
                            flexShrink: 0,
                          }}
                        />
                        <strong>{row.name}</strong>
                        <span style={{ color: C.textDim }}>
                          {discrete ? fmtPct(pct) : `${fmtFcfa(row.value)} · ${fmtPct(pct)}`}
                          {sector !== "Tous" ? " du secteur" : " du portefeuille"}
                        </span>
                      </p>
                    );
                  })()
                : null}
            </label>
          )}
        </>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  padding: "6px 8px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  background: C.bg,
  color: C.text,
  fontSize: "0.78rem",
  fontFamily: "inherit",
};
