"use client";

import { useState } from "react";
import { C } from "@/lib/theme/colors";
import { notifyPortfolioChanged } from "@/lib/api/portfolio-trades-client";
import type { OtherHoldingMetrics, OtherInstrumentKind, OtherPriceMode } from "@/lib/calc/other-holding-metrics";
import { useI18n } from "@/components/i18n/I18nProvider";
import { formatIso, localizeBasisLabel, showPortfolioApiError } from "@/components/portfolio/portfolio-i18n";
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

function money(value: number | "N/D", format: ReturnType<typeof useI18n>["format"]): string {
  return value === "N/D" ? "N/D" : format.fcfa(value);
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

  const { t } = useI18n();
  if (part === "form") {
    return <AddOtherForm portfolioId={portfolioId} />;
  }

  if (part === "tables" && bonds.length === 0 && funds.length === 0) return null;

  return (
    <div data-testid="other-holdings" style={{ marginTop: part === "tables" ? 8 : 18 }}>
      <Group title={t("portfolio.other.bonds")} rows={bonds} portfolioId={portfolioId} portfolioValue={portfolioValue} />
      <Group title={t("portfolio.other.funds")} rows={funds} portfolioId={portfolioId} portfolioValue={portfolioValue} />
      {part === "all" ? <AddOtherForm portfolioId={portfolioId} /> : null}
    </div>
  );
}

function weightLabel(
  row: OtherHoldingMetrics,
  portfolioValue: number,
  format: ReturnType<typeof useI18n>["format"]
): string {
  if (typeof row.marketValue !== "number" || portfolioValue <= 0) return "N/D";
  return format.percent((row.marketValue / portfolioValue) * 100, 1);
}

function coursLabel(row: OtherHoldingMetrics, format: ReturnType<typeof useI18n>["format"]): string {
  if (row.latestValue != null) return row.priceMode === "PERCENT" ? format.percent(row.latestValue, 2) : format.fcfa(row.latestValue);
  if (row.valueBasis === "purchase") return row.priceMode === "PERCENT" ? format.percent(row.avgBuyPrice, 2) : format.fcfa(row.avgBuyPrice);
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
  const { t, format } = useI18n();
  if (rows.length === 0) return null;
  const valued = rows.filter((row) => typeof row.marketValue === "number");
  const total = valued.reduce((sum, row) => sum + (row.marketValue as number), 0);
  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ color: C.gold, fontSize: "0.95rem", margin: "0 0 8px" }}>
        {title}
        <span style={{ color: C.textDim, fontWeight: 500, marginLeft: 8 }}>
          {rows.length === 0
            ? t("portfolio.noneLine")
            : valued.length === rows.length
              ? format.fcfa(total)
              : t("portfolio.partialNd", { amount: format.fcfa(total) })}
        </span>
      </h3>
      {rows.length === 0 ? null : (
        <div className={styles.scroll} style={{ overflowX: "auto" }}>
          <table className={styles.table} style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ color: C.textDim, textAlign: "left" }}>
                <th style={{ padding: "6px 8px" }}>{t("portfolio.other.security")}</th>
                <th style={{ padding: "6px 8px" }}>{t("portfolio.other.qty")}</th>
                <th style={{ padding: "6px 8px" }}>PRU</th>
                <th style={{ padding: "6px 8px" }}>{t("portfolio.other.price")}</th>
                <th style={{ padding: "6px 8px" }}>{t("portfolio.other.value")}</th>
                <th style={{ padding: "6px 8px" }}>{t("portfolio.other.pnl")}</th>
                <th style={{ padding: "6px 8px" }}>%</th>
                <th style={{ padding: "6px 8px" }}>{t("portfolio.other.weight")}</th>
                <th className="ob-col-secondary" style={{ padding: "6px 8px" }}>{t("portfolio.other.coupon")}</th>
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
  const { t, format } = useI18n();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gainColor = row.gainLoss === "N/D" ? C.textDim : row.gainLoss >= 0 ? C.green : C.red;

  async function remove() {
    setError(null);
    const res = await fetch(`/api/portfolio/${portfolioId}/other-holdings/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(showPortfolioApiError(t, json?.error, t("portfolio.other.deleteFailed")));
      return;
    }
    notifyPortfolioChanged(portfolioId);
  }

  return (
    <>
      <tr style={{ borderTop: `1px solid ${C.border}` }} data-kind={row.kind}>
        <td style={{ padding: "8px" }} data-label={t("portfolio.other.security")} data-span="all">
          <strong>{row.name}</strong>
          <span style={{ display: "block", color: C.textDim, fontSize: "0.72rem" }}>
            {row.isin || row.code || t("portfolio.other.isinNd")}
            {row.manager ? ` · ${row.manager}` : ""}
            {row.maturityDate ? ` · ${t("portfolio.other.maturity", { date: formatIso(format, row.maturityDate) })}` : ""}
          </span>
        </td>
        <td style={{ padding: "8px" }} className="ob-num" data-label={t("portfolio.other.qty")}>
          {row.quantity}
        </td>
        <td style={{ padding: "8px" }} className="ob-num" data-label="PRU">
          {row.priceMode === "PERCENT" ? format.percent(row.avgBuyPrice, 2) : format.fcfa(row.avgBuyPrice)}
          {row.nominal != null ? (
            <span style={{ display: "block", color: C.textDim, fontSize: "0.72rem" }}>
              {t("portfolio.other.nominal", { amount: format.fcfa(row.nominal) })}
            </span>
          ) : null}
        </td>
        <td style={{ padding: "8px" }} className="ob-num" data-label={t("portfolio.other.price")}>
          {coursLabel(row, format)}
        </td>
        <td style={{ padding: "8px" }} data-label={t("portfolio.other.value")}>
          <span className="ob-num">{money(row.marketValue, format)}</span>
          <span style={{ display: "block", color: C.textDim, fontSize: "0.72rem" }}>{localizeBasisLabel(row.valueBasisLabel, t)}</span>
        </td>
        <td style={{ padding: "8px", color: gainColor }} className="ob-num" data-label={t("portfolio.other.pnl")}>
          {row.gainLoss === "N/D" ? "N/D" : `${row.gainLoss >= 0 ? "+" : ""}${format.fcfa(row.gainLoss)}`}
        </td>
        <td style={{ padding: "8px", color: gainColor }} className="ob-num" data-label="%">
          {row.gainLossPercent === "N/D" ? "N/D" : format.percent(row.gainLossPercent, 2, true)}
        </td>
        <td style={{ padding: "8px" }} className="ob-num" data-label={t("portfolio.other.weight")}>
          {weightLabel(row, portfolioValue, format)}
        </td>
        <td style={{ padding: "8px" }} className="ob-col-secondary" data-label={t("portfolio.other.coupon")}>
          <span className="ob-num">{money(row.accruedCoupon, format)}</span>
          {row.accruedCoupon !== "N/D" ? (
            <span style={{ display: "block", color: C.textDim, fontSize: "0.72rem" }}>{localizeBasisLabel(row.accruedCouponLabel, t)}</span>
          ) : null}
        </td>
        <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
          <button type="button" className="ob-btn-ghost" onClick={() => setEditing((open) => !open)}>
            {editing ? t("common.close") : t("common.edit")}
          </button>
          <button type="button" className="ob-btn-ghost" onClick={() => void remove()} style={{ marginLeft: 6 }}>
            {t("common.delete")}
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
  const { t } = useI18n();
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
      setError(showPortfolioApiError(t, json?.error, t("portfolio.other.saveFailed")));
      return;
    }
    onDone();
    notifyPortfolioChanged(portfolioId);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
      <Field label={t("portfolio.other.name")}>
        <input name="name" required defaultValue={row.name} style={inputStyle} />
      </Field>
      <Field label="ISIN">
        <input name="isin" defaultValue={row.isin ?? ""} style={inputStyle} placeholder="N/D" />
      </Field>
      <Field label={t("portfolio.other.code")}>
        <input name="code" defaultValue={row.code ?? ""} style={inputStyle} />
      </Field>
      {row.kind === "FCP" ? (
        <Field label={t("portfolio.other.manager")}>
          <input name="manager" defaultValue={row.manager ?? ""} style={inputStyle} />
        </Field>
      ) : null}
      <Field label={row.kind === "FCP" ? t("portfolio.other.parts") : t("portfolio.other.quantity")}>
        <input name="quantity" required defaultValue={String(row.quantity)} inputMode="decimal" style={inputStyle} className="ob-num" />
      </Field>
      <Field label={t("portfolio.other.buyPrice")}>
        <input name="avgBuyPrice" required defaultValue={String(row.avgBuyPrice)} inputMode="decimal" style={inputStyle} className="ob-num" />
      </Field>
      {row.kind === "OBLIGATION" ? (
        <Field label={t("portfolio.other.priceUnit")}>
          <select name="priceMode" defaultValue={row.priceMode} style={inputStyle}>
            <option value="FCFA">{t("portfolio.other.unitFcfa")}</option>
            <option value="PERCENT">{t("portfolio.other.unitPercent")}</option>
          </select>
        </Field>
      ) : null}
      {row.kind === "OBLIGATION" ? (
        <>
          <Field label={t("portfolio.other.nominalField")}>
            <input name="nominal" defaultValue={row.nominal ?? ""} inputMode="decimal" style={inputStyle} placeholder="N/D" />
          </Field>
          <Field label={t("portfolio.other.couponRate")}>
            <input name="couponRate" defaultValue={row.couponRate ?? ""} inputMode="decimal" style={inputStyle} placeholder="N/D" />
          </Field>
          <Field label={t("portfolio.other.maturityField")}>
            <input name="maturityDate" type="date" defaultValue={row.maturityDate ?? ""} style={inputStyle} />
          </Field>
        </>
      ) : (
        <Field label={t("portfolio.other.lastNav")}>
          <input name="latestValue" defaultValue={row.latestValue ?? ""} inputMode="decimal" style={inputStyle} placeholder="N/D" />
        </Field>
      )}
      {row.kind === "OBLIGATION" ? (
        <Field label={t("portfolio.other.lastPrice")}>
          <input name="latestValue" defaultValue={row.latestValue ?? ""} inputMode="decimal" style={inputStyle} placeholder="N/D" />
        </Field>
      ) : null}
      <Field label={t("portfolio.other.buyDate")}>
        <input name="buyDate" type="date" defaultValue={row.buyDate ?? ""} style={inputStyle} />
      </Field>
      <button type="submit" className="ob-btn-gold" disabled={busy}>
        {busy ? t("portfolio.other.saving") : t("common.save")}
      </button>
      {error ? <span style={{ color: C.red, fontSize: "0.78rem" }}>{error}</span> : null}
    </form>
  );
}

function AddOtherForm({ portfolioId }: { portfolioId: string }) {
  const { t } = useI18n();
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
      setError(showPortfolioApiError(t, json?.error, t("portfolio.other.addFailed")));
      return;
    }
    event.currentTarget.reset();
    setKind("OBLIGATION");
    setPriceMode("FCFA");
    notifyPortfolioChanged(portfolioId);
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
      <Field label={t("portfolio.other.add")}>
        <select value={kind} onChange={(event) => setKind(event.target.value as Kind)} style={inputStyle} aria-label={t("portfolio.other.kindAria")}>
          <option value="OBLIGATION">{t("portfolio.other.bond")}</option>
          <option value="FCP">FCP</option>
        </select>
      </Field>
      <Field label={t("portfolio.other.name")}>
        <input name="name" required style={inputStyle} placeholder={kind === "FCP" ? t("portfolio.other.fundName") : t("portfolio.other.bondName")} />
      </Field>
      <Field label="ISIN">
        <input name="isin" style={inputStyle} placeholder="N/D" />
      </Field>
      {kind === "FCP" ? (
        <Field label={t("portfolio.other.manager")}>
          <input name="manager" style={inputStyle} />
        </Field>
      ) : null}
      <Field label={kind === "FCP" ? t("portfolio.other.parts") : t("portfolio.other.quantity")}>
        <input name="quantity" required inputMode="decimal" style={inputStyle} className="ob-num" />
      </Field>
      <Field label={t("portfolio.other.buyPrice")}>
        <input name="avgBuyPrice" required inputMode="decimal" style={inputStyle} className="ob-num" />
      </Field>
      {kind === "OBLIGATION" ? (
        <Field label={t("portfolio.other.priceUnit")}>
          <select value={priceMode} onChange={(event) => setPriceMode(event.target.value as OtherPriceMode)} style={inputStyle}>
            <option value="FCFA">{t("portfolio.other.unitFcfa")}</option>
            <option value="PERCENT">{t("portfolio.other.unitPercent")}</option>
          </select>
        </Field>
      ) : null}
      {kind === "OBLIGATION" ? (
        <>
          <Field label={t("portfolio.other.nominalField")}>
            <input name="nominal" inputMode="decimal" style={inputStyle} placeholder="N/D" />
          </Field>
          <Field label={t("portfolio.other.couponRate")}>
            <input name="couponRate" inputMode="decimal" style={inputStyle} placeholder="N/D" />
          </Field>
          <Field label={t("portfolio.other.maturityField")}>
            <input name="maturityDate" type="date" style={inputStyle} />
          </Field>
        </>
      ) : (
        <Field label={t("portfolio.other.lastNav")}>
          <input name="latestValue" inputMode="decimal" style={inputStyle} placeholder="N/D" />
        </Field>
      )}
      <Field label={t("portfolio.other.buyDate")}>
        <input name="buyDate" type="date" style={inputStyle} />
      </Field>
      <button type="submit" className="ob-btn-gold" disabled={busy}>
        {busy ? t("portfolio.other.adding") : t("portfolio.other.addLine")}
      </button>
      {error ? <span style={{ color: C.red, fontSize: "0.78rem" }}>{error}</span> : null}
    </form>
  );
}
