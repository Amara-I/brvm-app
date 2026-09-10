"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { CompanyProfileMeta } from "@/lib/api/company-sheet-dataset";
import styles from "./CompanySheet.module.css";

/** Palette colorée pour les actionnaires (hors flottant). */
const HOLDER_COLORS = [
  "#2F6FED", // bleu
  "#1FA97A", // vert
  "#D4A843", // or
  "#E0673A", // orange
  "#6B5CE7", // indigo
  "#0EA5A4", // teal
  "#C44B6A", // rose
  "#5B8C5A", // olive
];
const FLOAT_BLUE = "#4A90D9";

function isFloatName(name: string): boolean {
  return /flottant|float|public\b|bloc\s*flottant/i.test(name);
}

function displayName(name: string, isFloat: boolean): string {
  return isFloat ? "Flottant" : name;
}

function fmtPctFr(n: number): string {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`;
}

function formatAsOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const label = d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `au ${label}`;
}

export default function ShareholdingPanel({
  profileMeta,
}: {
  profileMeta: CompanyProfileMeta | null;
}) {
  const slices = useMemo(() => {
    const raw = (profileMeta?.shareholders ?? [])
      .filter((s) => s.name && s.percent != null && s.percent > 0)
      .map((s) => ({ name: s.name, percent: s.percent as number, isFloat: isFloatName(s.name) }));

    const hasFloat = raw.some((s) => s.isFloat);
    if (!hasFloat && profileMeta?.floatPercent != null && profileMeta.floatPercent > 0) {
      raw.push({ name: "Flottant", percent: profileMeta.floatPercent, isFloat: true });
    }

    const holders = raw.filter((s) => !s.isFloat).sort((a, b) => b.percent - a.percent);
    const floats = raw.filter((s) => s.isFloat);
    const ordered = [...holders, ...floats];

    let colorIdx = 0;
    return ordered.map((s) => ({
      ...s,
      name: displayName(s.name, s.isFloat),
      color: s.isFloat ? FLOAT_BLUE : HOLDER_COLORS[colorIdx++ % HOLDER_COLORS.length]!,
    }));
  }, [profileMeta]);

  const floatCenter = useMemo(() => {
    if (profileMeta?.floatPercent != null && Number.isFinite(profileMeta.floatPercent)) {
      return profileMeta.floatPercent;
    }
    const f = slices.find((s) => s.isFloat);
    return f?.percent ?? null;
  }, [profileMeta, slices]);

  const asOfLabel = formatAsOf(profileMeta?.shareholdersAsOf);
  const twoCols = slices.length > 4;
  // Plus il y a d'actionnaires, plus la légende prend de place → donut un peu plus compact.
  const donutSize =
    slices.length <= 3 ? 360 : slices.length <= 5 ? 320 : slices.length <= 8 ? 280 : 240;
  const donutInner = Math.round(donutSize * 0.33);
  const donutOuter = Math.round(donutSize * 0.47);

  if (slices.length === 0) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Actionnariat</h2>
        <p className={styles.empty}>Répartition actionnariale non disponible (N/D).</p>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.shareholdingHeader}>
        <h2 className={styles.cardTitle} style={{ margin: 0 }}>
          Actionnariat
        </h2>
        {asOfLabel ? <p className={styles.shareholdingAsOf}>{asOfLabel}</p> : null}
      </div>

      <div className={styles.shareholdingBody}>
        <div
          className={styles.shareholdingDonutWrap}
          style={{ width: donutSize, flexBasis: donutSize }}
        >
          <ResponsiveContainer width="100%" height={donutSize}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="percent"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={donutInner}
                outerRadius={donutOuter}
                paddingAngle={1.5}
                stroke="transparent"
                startAngle={90}
                endAngle={-270}
              >
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.shareholdingCenter} aria-hidden>
            <strong
              style={{
                fontSize: donutSize >= 320 ? "2rem" : donutSize >= 280 ? "1.7rem" : "1.4rem",
              }}
            >
              {floatCenter != null ? fmtPctFr(floatCenter) : "N/D"}
            </strong>
            <span>flottant</span>
          </div>
        </div>

        <ul
          className={`${styles.shareholdingLegend}${twoCols ? ` ${styles.shareholdingLegendCols}` : ""}`}
        >
          {slices.map((s) => (
            <li key={s.name}>
              <span className={styles.shareholdingSwatch} style={{ background: s.color }} />
              <span className={styles.shareholdingName} title={s.name}>
                {s.name}
              </span>
              <strong>{fmtPctFr(s.percent)}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
