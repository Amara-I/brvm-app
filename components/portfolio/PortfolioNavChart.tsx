"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { C } from "@/lib/theme/colors";
import type { PortfolioNavPoint } from "@/lib/api/portfolio-nav-series";
import EducationTermLink from "@/components/education/EducationTermLink";
import { DISCRETE_AMOUNT_LABEL } from "@/lib/portfolio/discrete-mode";

function fmtFcfa(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function fmtDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Domaine Y resserré autour des données pour rendre visibles les petites variations journalières. */
function yDomainForSeries(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span <= 0) {
    const pad = Math.max(max * 0.005, 1);
    return [min - pad, max + pad];
  }
  const pad = Math.max(span * 0.12, max * 0.001);
  return [min - pad, max + pad];
}

function fmtYAxisTick(v: number, domain: [number, number]): string {
  const span = domain[1] - domain[0];
  if (span < domain[1] * 0.03) {
    return `${(v / 1_000_000).toFixed(2)}M`;
  }
  if (span < domain[1] * 0.08) {
    return `${(v / 1_000).toFixed(0)}k`;
  }
  return `${Math.round(v / 1_000)}k`;
}

export default function PortfolioNavChart({
  series,
  titleSlug,
  discrete = false,
}: {
  series: PortfolioNavPoint[];
  titleSlug?: string;
  discrete?: boolean;
}) {
  if (series.length < 2) {
    return (
      <p style={{ color: C.textDim, fontSize: "0.82rem", margin: "8px 0 0" }}>
        Pas encore assez d&apos;historique de cours pour tracer l&apos;évolution quotidienne (N/D).
      </p>
    );
  }

  const first = series[0]!;
  const last = series[series.length - 1]!;
  const totalChange =
    first.value > 0 ? Math.round(((last.value - first.value) / first.value) * 1000) / 10 : null;
  const dayChange = last.changePercent;
  const values = series.map((p) => p.value);
  const yDomain = yDomainForSeries(values);

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <div style={{ color: C.gold, fontSize: "0.85rem", fontWeight: 700 }}>
          {titleSlug ? (
            <EducationTermLink slug={titleSlug}>Évolution quotidienne</EducationTermLink>
          ) : (
            "Évolution quotidienne"
          )}
        </div>
        <div style={{ fontSize: "0.75rem", color: C.textDim }}>
          {fmtDay(first.date)} → {fmtDay(last.date)}
          {totalChange != null ? (
            <span style={{ marginLeft: 8, color: totalChange >= 0 ? C.green : C.red, fontWeight: 700 }}>
              {totalChange >= 0 ? "+" : ""}
              {totalChange}%
            </span>
          ) : null}
          {dayChange != null ? (
            <span style={{ marginLeft: 8 }}>
              · veille{" "}
              <span style={{ color: dayChange >= 0 ? C.green : C.red, fontWeight: 700 }}>
                {dayChange >= 0 ? "+" : ""}
                {dayChange}%
              </span>
            </span>
          ) : null}
        </div>
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDay}
              tick={{ fill: C.textDim, fontSize: 11 }}
              minTickGap={28}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={(v) => (discrete ? "•••" : fmtYAxisTick(Number(v), yDomain))}
              tick={{ fill: C.textDim, fontSize: 11 }}
              width={56}
            />
            <Tooltip
              contentStyle={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                fontSize: "0.78rem",
              }}
              labelFormatter={(l) => `Séance du ${String(l).split("-").reverse().join("/")}`}
              formatter={(value, _name, item) => {
                const pt = item?.payload as PortfolioNavPoint | undefined;
                const day =
                  pt?.changePercent != null
                    ? ` (${pt.changePercent >= 0 ? "+" : ""}${pt.changePercent}% vs veille)`
                    : "";
                return [
                  discrete ? `${DISCRETE_AMOUNT_LABEL}${day}` : `${fmtFcfa(Number(value))}${day}`,
                  "Valeur",
                ];
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={C.gold}
              strokeWidth={2}
              dot={{ r: 2.5, fill: C.gold, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p style={{ color: C.textMeta, fontSize: "0.68rem", margin: "6px 0 0" }}>
        Axe vertical resserré sur la période affichée pour mettre en évidence les variations journalières.
        Calculé avec les quantités actuelles × cours de clôture canoniques (hors dates futures).
      </p>
    </div>
  );
}
