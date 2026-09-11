import { C } from "@/lib/theme/colors";
import EducationTermLink from "@/components/education/EducationTermLink";

export const panelStyle: React.CSSProperties = {
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: 20,
  marginBottom: 16,
  boxShadow: "var(--shadow-sm)",
};

/** Ligne allocation sectorielle + répartition par action (50 % / 50 %). */
export const allocationLayoutRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 20,
  alignItems: "start",
  marginTop: 8,
};

export const allocationSectorsCol: React.CSSProperties = {
  minWidth: 0,
};

export const allocationTickersCol: React.CSSProperties = {
  minWidth: 0,
};

export function fmtFcfa(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export function Kpi({
  label,
  value,
  color,
  hint,
  educationSlug,
}: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
  educationSlug?: string;
}) {
  return (
    <div className="ob-kpi">
      <p className="ob-kpi-label">
        {educationSlug ? <EducationTermLink slug={educationSlug}>{label}</EducationTermLink> : label}
      </p>
      <p className="ob-kpi-value" style={{ color: color ?? C.text }}>
        {value}
      </p>
      {hint ? <p className="ob-kpi-hint">{hint}</p> : null}
    </div>
  );
}

export function AllocationBars({
  items,
}: {
  items: Array<{ sector: string; weightPercent: number }>;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ color: C.gold, fontSize: "var(--fs-body-sm)", fontWeight: 700, marginBottom: 10 }}>
        <EducationTermLink slug="allocation-sectorielle">Allocation sectorielle</EducationTermLink>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((s) => (
          <div key={s.sector}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "var(--fs-body-sm)",
                color: C.textDim,
                marginBottom: 3,
              }}
            >
              <span>{s.sector}</span>
              <span>{s.weightPercent.toFixed(1)}%</span>
            </div>
            <div
              style={{
                height: 8,
                background: C.bg,
                borderRadius: 999,
                overflow: "hidden",
                border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ width: `${Math.min(100, s.weightPercent)}%`, height: "100%", background: C.green }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
