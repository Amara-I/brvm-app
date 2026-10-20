"use client";

import { useState } from "react";
import { C } from "@/lib/theme/colors";
import { notifyPortfolioChanged } from "@/lib/api/portfolio-trades-client";
import type { OtherHoldingMetrics, OtherInstrumentKind, OtherPriceMode } from "@/lib/calc/other-holding-metrics";
import { fmtFcfa } from "@/components/portfolio/PortfolioPageParts";
import styles from "./OtherHoldingsSection.module.css";

type Kind = OtherInstrumentKind;

const inputStyle: React.CSSProperties = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: "8px 10px",
  color: C.text,
  fontSize: "0.82rem",
  fontFamily: "inherit",
  minWidth: 0,
};

function money(value: number | "N/D"): string {
  return value === "N/D" ? "N/D" : fmtFcfa(value);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.7rem", color: C.textDim }}>
      {label}
      {children}
    </label>
  );
}

export default function OtherHoldingsSection({
  portfolioId,
  holdings,
  portfolioValue = 0,
  part = "all",
}: {
  portfolioId: string;
  holdings: OtherHoldingMetrics[];
  /** Valeur totale du portefeuille, pour le poids de chaque ligne. */
  portfolioValue?: number;
  /** `tables` au-dessus de la ligne de flottaison, `form` dans l’accordéon d’ajout. */
  part?: "all" | "tables" | "form";
}) {
  const bonds = holdings.filter((row) => row.kind === "OBLIGATION");
  const funds = holdings.filter((row) => row.kind === "FCP");

  if (part === "form") {
    return <AddOtherForm portfolioId={portfolioId} />;
  }

  if (part === "tables" && bonds.length === 0 && funds.length === 0) return null;

  return (
    <div data-testid="other-holdings" style={{ marginTop: part === "tables" ? 8 : 18 }}>
      <Group title="Obligations" rows={bonds} portfolioId={portfolioId} portfolioValue={portfolioValue} />
      <Group title="FCP" rows={funds} portfolioId={portfolioId} portfolioValue={portfolioValue} />
      {part === "all" ? <AddOtherForm portfolioId={portfolioId} /> : null}
    </div>
  );
}

function weightLabel(row: OtherHoldingMetrics, portfolioValue: number): string {
  if (typeof row.marketValue !== "number" || portfolioValue <= 0) return "N/D";
  return `${((row.marketValue / portfolioValue) * 100).toFixed(1)} %`;
}

function coursLabel(row: OtherHoldingMetrics): string {
  if (row.latestValue != null) return row.priceMode === "PERCENT" ? `${row.latestValue} %` : fmtFcfa(row.latestValue);
  if (row.valueBasis === "purchase") return row.priceMode === "PERCENT" ? `${row.avgBuyPrice} %` : fmtFcfa(row.avgBuyPrice);
  return "N/D";
}

function Group({
  title,
  rows,
  portfolioId,
  portfolioValue,
}: {
  title: string;
  rows: OtherHoldingMetrics[];
  portfolioId: string;
  portfolioValue: number;
}) {
  if (rows.length === 0) return null;
  const valued = rows.filter((row) => typeof row.marketValue === "number");
  const total = valued.reduce((sum, row) => sum + (row.marketValue as number), 0);
  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ color: C.gold, fontSize: "0.95rem", margin: "0 0 8px" }}>
        {title}
        <span style={{ color: C.textDim, fontWeight: 500, marginLeft: 8 }}>
          {rows.length === 0 ? "Aucune ligne" : valued.length === rows.length ? fmtFcfa(total) : `${fmtFcfa(total)} · certaines lignes N/D`}
        </span>
      </h3>
      {rows.length === 0 ? null : (
        <div className={styles.scroll} style={{ overflowX: "auto" }}>
          <table className={styles.table} style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ color: C.textDim, textAlign: "left" }}>
                <th style={{ padding: "6px 8px" }}>Titre</th>
                <th style={{ padding: "6px 8px" }}>Qté</th>
                <th style={{ padding: "6px 8px" }}>PRU</th>
                <th style={{ padding: "6px 8px" }}>Cours</th>
                <th style={{ padding: "6px 8px" }}>Valeur</th>
                <th style={{ padding: "6px 8px" }}>+/− value</th>
                <th style={{ padding: "6px 8px" }}>%</th>
                <th style={{ padding: "6px 8px" }}>Poids</th>
                <th className="ob-col-secondary" style={{ padding: "6px 8px" }}>Coupon couru</th>
                <th style={{ padding: "6px 8px" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <HoldingRow key={row.id} portfolioId={portfolioId} row={row} portfolioValue={portfolioValue} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HoldingRow({
  portfolioId,
  row,
  portfolioValue,
}: {
  portfolioId: string;
  row: OtherHoldingMetrics;
  portfolioValue: number;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gainColor = row.gainLoss === "N/D" ? C.textDim : row.gainLoss >= 0 ? C.green : C.red;

  async function remove() {
    setError(null);
    const res = await fetch(`/api/portfolio/${portfolioId}/other-holdings/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error ?? "Suppression impossible.");
      return;
    }
    notifyPortfolioChanged(portfolioId);
  }

  return (
    <>
      <tr style={{ borderTop: `1px solid ${C.border}` }} data-kind={row.kind}>
        <td style={{ padding: "8px" }} data-label="Titre">
          <strong>{row.name}</strong>
          <span style={{ display: "block", color: C.textDim, fontSize: "0.72rem" }}>
            {row.isin || row.code || "ISIN N/D"}
            {row.manager ? ` · ${row.manager}` : ""}
            {row.maturityDate ? ` · échéance ${row.maturityDate.split("-").reverse().join("/")}` : ""}
          </span>
        </td>
        <td style={{ padding: "8px" }} className="ob-num" data-label="Qté">
          {row.quantity}
        </td>
        <td style={{ padding: "8px" }} className="ob-num" data-label="PRU">
          {row.priceMode === "PERCENT" ? `${row.avgBuyPrice} %` : fmtFcfa(row.avgBuyPrice)}
          {row.nominal != null ? (
            <span style={{ display: "block", color: C.textDim, fontSize: "0.72rem" }}>Nominal {fmtFcfa(row.nominal)}</span>
          ) : null}
        </td>
        <td style={{ padding: "8px" }} className="ob-num" data-label="Cours">
          {coursLabel(row)}
        </td>
        <td style={{ padding: "8px" }} data-label="Valeur">
          <span className="ob-num">{money(row.marketValue)}</span>
          <span style={{ display: "block", color: C.textDim, fontSize: "0.72rem" }}>{row.valueBasisLabel}</span>
        </td>
        <td style={{ padding: "8px", color: gainColor }} className="ob-num" data-label="+/− value">
          {row.gainLoss === "N/D" ? "N/D" : `${row.gainLoss >= 0 ? "+" : ""}${fmtFcfa(row.gainLoss)}`}
        </td>
        <td style={{ padding: "8px", color: gainColor }} className="ob-num" data-label="%">
          {row.gainLossPercent === "N/D" ? "N/D" : `${row.gainLossPercent >= 0 ? "+" : ""}${row.gainLossPercent} %`}
        </td>
        <td style={{ padding: "8px" }} className="ob-num" data-label="Poids">
          {weightLabel(row, portfolioValue)}
        </td>
        <td style={{ padding: "8px" }} className="ob-col-secondary" data-label="Coupon couru">
          <span className="ob-num">{money(row.accruedCoupon)}</span>
          {row.accruedCoupon !== "N/D" ? (
            <span style={{ display: "block", color: C.textDim, fontSize: "0.72rem" }}>{row.accruedCouponLabel}</span>
          ) : null}
        </td>
        <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
          <button type="button" className="ob-btn-ghost" onClick={() => setEditing((open) => !open)}>
            {editing ? "Fermer" : "Modifier"}
          </button>
          <button type="button" className="ob-btn-ghost" onClick={() => void remove()} style={{ marginLeft: 6 }}>
            Supprimer
          </button>
          {error ? <span style={{ display: "block", color: C.red, fontSize: "0.72rem" }}>{error}</span> : null}
        </td>
      </tr>
      {editing && row.id ? (
        <tr>
          <td colSpan={10} style={{ padding: "8px 8px 14px" }}>
            <EditOtherForm portfolioId={portfolioId} row={row} onDone={() => setEditing(false)} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function EditOtherForm({
  portfolioId,
  row,
  onDone,
}: {
  portfolioId: string;
  row: OtherHoldingMetrics;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const res = await fetch(`/api/portfolio/${portfolioId}/other-holdings/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error ?? "Enregistrement impossible.");
      return;
    }
    onDone();
    notifyPortfolioChanged(portfolioId);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
      <Field label="Nom">
        <input name="name" required defaultValue={row.name} style={inputStyle} />
      </Field>
      <Field label="ISIN">
        <input name="isin" defaultValue={row.isin ?? ""} style={inputStyle} placeholder="N/D" />
      </Field>
      <Field label="Code">
        <input name="code" defaultValue={row.code ?? ""} style={inputStyle} />
      </Field>
      {row.kind === "FCP" ? (
        <Field label="Société de gestion">
          <input name="manager" defaultValue={row.manager ?? ""} style={inputStyle} />
        </Field>
      ) : null}
      <Field label={row.kind === "FCP" ? "Nombre de parts" : "Quantité"}>
        <input name="quantity" required defaultValue={String(row.quantity)} inputMode="decimal" style={inputStyle} className="ob-num" />
      </Field>
      <Field label="Prix d’achat">
        <input name="avgBuyPrice" required defaultValue={String(row.avgBuyPrice)} inputMode="decimal" style={inputStyle} className="ob-num" />
      </Field>
      {row.kind === "OBLIGATION" ? (
        <Field label="Unité du prix">
          <select name="priceMode" defaultValue={row.priceMode} style={inputStyle}>
            <option value="FCFA">FCFA (prix unitaire)</option>
            <option value="PERCENT">% du nominal</option>
          </select>
        </Field>
      ) : null}
      {row.kind === "OBLIGATION" ? (
        <>
          <Field label="Nominal">
            <input name="nominal" defaultValue={row.nominal ?? ""} inputMode="decimal" style={inputStyle} placeholder="N/D" />
          </Field>
          <Field label="Coupon % annuel">
            <input name="couponRate" defaultValue={row.couponRate ?? ""} inputMode="decimal" style={inputStyle} placeholder="N/D" />
          </Field>
          <Field label="Échéance">
            <input name="maturityDate" type="date" defaultValue={row.maturityDate ?? ""} style={inputStyle} />
          </Field>
        </>
      ) : (
        <Field label="Dernière VL">
          <input name="latestValue" defaultValue={row.latestValue ?? ""} inputMode="decimal" style={inputStyle} placeholder="N/D" />
        </Field>
      )}
      {row.kind === "OBLIGATION" ? (
        <Field label="Dernier prix connu">
          <input name="latestValue" defaultValue={row.latestValue ?? ""} inputMode="decimal" style={inputStyle} placeholder="N/D" />
        </Field>
      ) : null}
      <Field label="Date d’achat">
        <input name="buyDate" type="date" defaultValue={row.buyDate ?? ""} style={inputStyle} />
      </Field>
      <button type="submit" className="ob-btn-gold" disabled={busy}>
        {busy ? "Enregistrement…" : "Enregistrer"}
      </button>
      {error ? <span style={{ color: C.red, fontSize: "0.78rem" }}>{error}</span> : null}
    </form>
  );
}

function AddOtherForm({ portfolioId }: { portfolioId: string }) {
  const [kind, setKind] = useState<Kind>("OBLIGATION");
  const [priceMode, setPriceMode] = useState<OtherPriceMode>("FCFA");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const res = await fetch(`/api/portfolio/${portfolioId}/other-holdings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, kind, priceMode: kind === "FCP" ? "FCFA" : priceMode }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error ?? "Ajout impossible.");
      return;
    }
    event.currentTarget.reset();
    setKind("OBLIGATION");
    setPriceMode("FCFA");
    notifyPortfolioChanged(portfolioId);
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
      <Field label="Ajouter">
        <select value={kind} onChange={(event) => setKind(event.target.value as Kind)} style={inputStyle} aria-label="Type de ligne">
          <option value="OBLIGATION">Obligation</option>
          <option value="FCP">FCP</option>
        </select>
      </Field>
      <Field label="Nom">
        <input name="name" required style={inputStyle} placeholder={kind === "FCP" ? "Nom du fonds" : "Nom de l’obligation"} />
      </Field>
      <Field label="ISIN">
        <input name="isin" style={inputStyle} placeholder="N/D" />
      </Field>
      {kind === "FCP" ? (
        <Field label="Société de gestion">
          <input name="manager" style={inputStyle} />
        </Field>
      ) : null}
      <Field label={kind === "FCP" ? "Nombre de parts" : "Quantité"}>
        <input name="quantity" required inputMode="decimal" style={inputStyle} className="ob-num" />
      </Field>
      <Field label="Prix d’achat">
        <input name="avgBuyPrice" required inputMode="decimal" style={inputStyle} className="ob-num" />
      </Field>
      {kind === "OBLIGATION" ? (
        <Field label="Unité du prix">
          <select value={priceMode} onChange={(event) => setPriceMode(event.target.value as OtherPriceMode)} style={inputStyle}>
            <option value="FCFA">FCFA (prix unitaire)</option>
            <option value="PERCENT">% du nominal</option>
          </select>
        </Field>
      ) : null}
      {kind === "OBLIGATION" ? (
        <>
          <Field label="Nominal">
            <input name="nominal" inputMode="decimal" style={inputStyle} placeholder="N/D" />
          </Field>
          <Field label="Coupon % annuel">
            <input name="couponRate" inputMode="decimal" style={inputStyle} placeholder="N/D" />
          </Field>
          <Field label="Échéance">
            <input name="maturityDate" type="date" style={inputStyle} />
          </Field>
        </>
      ) : (
        <Field label="Dernière VL">
          <input name="latestValue" inputMode="decimal" style={inputStyle} placeholder="N/D" />
        </Field>
      )}
      <Field label="Date d’achat">
        <input name="buyDate" type="date" style={inputStyle} />
      </Field>
      <button type="submit" className="ob-btn-gold" disabled={busy}>
        {busy ? "Ajout…" : "Ajouter la ligne"}
      </button>
      {error ? <span style={{ color: C.red, fontSize: "0.78rem" }}>{error}</span> : null}
    </form>
  );
}
