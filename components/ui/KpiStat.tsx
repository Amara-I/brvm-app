import type { CSSProperties, ReactNode } from "react";

type Props = {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  valueStyle?: CSSProperties;
};

export default function KpiStat({ label, value, hint, valueStyle }: Props) {
  return (
    <div className="ob-kpi">
      <p className="ob-kpi-label">{label}</p>
      <p className="ob-kpi-value" style={valueStyle}>
        {value}
      </p>
      {hint ? <p className="ob-kpi-hint">{hint}</p> : null}
    </div>
  );
}
