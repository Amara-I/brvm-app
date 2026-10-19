"use client";

import { useId, useMemo, useRef, useState } from "react";
import { notifyPortfolioChanged } from "@/lib/api/portfolio-trades-client";
import { parseFrNumber } from "@/lib/portfolio/sgi-statement/french-number";
import { STATEMENT_ERRORS, STATEMENT_MAX_BYTES } from "@/lib/portfolio/sgi-statement/messages";
import type { MatchConfidence, StatementCompanyOption, StatementPreview, StatementRowDraft } from "@/lib/portfolio/sgi-statement/types";
import styles from "./PortfolioStatementImport.module.css";

type Props = {
  portfolioId: string;
  portfolioName: string;
  holdingCount: number;
};

type Draft = {
  id: string;
  include: boolean;
  rawLine: string;
  label: string;
  quantity: string;
  avgBuyPrice: string;
  lastPrice: number | null;
  valuation: number | null;
  companyId: string;
  confidence: MatchConfidence;
  ambiguous: boolean;
  warnings: string[];
  manual: boolean;
};

const CONFIDENCE_LABEL: Record<MatchConfidence, string> = {
  haute: "Haute",
  moyenne: "Moyenne",
  faible: "Faible",
  aucune: "Aucune",
};

function toInput(value: number | null): string {
  if (value == null) return "";
  if (Number.isInteger(value)) return String(value);
  return String(value).replace(".", ",");
}

function formatFcfa(value: number | null): string {
  if (value == null) return "N/D";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value)} FCFA`;
}

function includeByDefault(row: StatementRowDraft): boolean {
  if (row.quantity == null || row.quantity <= 0) return false;
  if (row.match.confidence === "haute") return true;
  return row.match.confidence === "moyenne" && !row.match.ambiguous;
}

function toDraft(row: StatementRowDraft): Draft {
  return {
    id: row.id,
    include: includeByDefault(row),
    rawLine: row.rawLine,
    label: row.label,
    quantity: toInput(row.quantity),
    avgBuyPrice: toInput(row.avgBuyPrice),
    lastPrice: row.lastPrice,
    valuation: row.valuation,
    companyId: row.match.companyId ?? "",
    confidence: row.match.confidence,
    ambiguous: row.match.ambiguous,
    warnings: row.warnings,
    manual: false,
  };
}

export default function PortfolioStatementImport({ portfolioId, portfolioName, holdingCount }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<"parse" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [rows, setRows] = useState<Draft[]>([]);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [replaceAck, setReplaceAck] = useState(false);
  const [statementDate, setStatementDate] = useState("");

  const companies = preview?.companies ?? [];
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);

  function resetReview() {
    setPreview(null);
    setRows([]);
    setMode("merge");
    setReplaceAck(false);
    setStatementDate("");
  }

  async function parseFile(file: File) {
    setError(null);
    setMessage(null);
    const name = file.name.toLowerCase();
    const allowed = name.endsWith(".pdf") || name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!allowed) {
      setError(STATEMENT_ERRORS.UNSUPPORTED);
      return;
    }
    if (file.size <= 0) {
      setError(STATEMENT_ERRORS.EMPTY);
      return;
    }
    if (file.size > STATEMENT_MAX_BYTES) {
      setError(STATEMENT_ERRORS.TOO_LARGE);
      return;
    }

    setBusy("parse");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/portfolio/${portfolioId}/import-statement`, { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Lecture du relevé impossible.");
      const data = json.data as StatementPreview;
      setPreview(data);
      setRows(data.rows.map(toDraft));
      setStatementDate(data.statementDate ?? "");
      setMode("merge");
      setReplaceAck(false);
    } catch (err) {
      resetReview();
      setError(err instanceof Error ? err.message : "Lecture du relevé impossible.");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    void parseFile(file);
  }

  function patch(id: string, partial: Partial<Draft>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...partial } : row)));
  }

  function applyLastPrice(id: string) {
    const row = rows.find((item) => item.id === id);
    if (!row?.lastPrice) return;
    patch(id, { avgBuyPrice: toInput(row.lastPrice) });
  }

  function applyMissingPrices() {
    setRows((current) =>
      current.map((row) => (row.include && !row.avgBuyPrice.trim() && row.lastPrice ? { ...row, avgBuyPrice: toInput(row.lastPrice) } : row))
    );
  }

  const included = rows.filter((row) => row.include);
  const blocked = included.filter((row) => {
    const quantity = parseFrNumber(row.quantity);
    const price = parseFrNumber(row.avgBuyPrice);
    return !row.companyId || quantity == null || quantity <= 0 || price == null || price <= 0;
  });

  async function save() {
    setError(null);
    setMessage(null);
    if (included.length === 0) {
      setError("Cochez au moins une ligne à enregistrer.");
      return;
    }
    if (blocked.length > 0) {
      setError("Complétez la société, la quantité et le PRU des lignes cochées, ou décochez-les.");
      return;
    }
    if (mode === "replace" && !replaceAck) {
      setError("Cochez la confirmation pour remplacer les positions actuelles.");
      return;
    }

    setBusy("save");
    try {
      const res = await fetch(`/api/portfolio/${portfolioId}/import-statement/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          statementDate: statementDate || null,
          issuer: preview?.issuer ?? null,
          rows: included.map((row) => ({
            companyId: row.companyId,
            quantity: parseFrNumber(row.quantity),
            avgBuyPrice: parseFrNumber(row.avgBuyPrice),
          })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Enregistrement impossible.");
      const data = json.data as { created: number; updated: number; deleted: number };
      const parts = [
        mode === "replace" ? `${data.deleted} position(s) retirée(s)` : null,
        data.created ? `${data.created} créée(s)` : null,
        data.updated ? `${data.updated} renforcée(s)` : null,
      ].filter(Boolean);
      setMessage(`Relevé importé dans « ${portfolioName} » — ${parts.join(" · ") || "aucune modification"}.`);
      resetReview();
      notifyPortfolioChanged(portfolioId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  }

  const phase = message && !preview ? "done" : preview ? "review" : "upload";

  return (
    <section className={styles.card} data-testid="sgi-import" aria-labelledby={`${inputId}-title`}>
      <ol className={styles.steps}>
        <li data-state={phase === "upload" ? "current" : "done"}>1. Déposer</li>
        <li data-state={phase === "review" ? "current" : phase === "done" ? "done" : "todo"}>2. Vérifier</li>
        <li data-state={phase === "done" ? "current" : "todo"}>3. Enregistrer</li>
      </ol>

      <div
        className={styles.drop}
        data-active={dragOver ? "true" : "false"}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          onFile(event.dataTransfer.files?.[0]);
        }}
      >
        <div className={styles.mark} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 4v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M8 8l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h3 id={`${inputId}-title`} className={styles.title}>
            Importer un relevé SGI
          </h3>
          <p className={styles.lead} id={`${inputId}-hint`}>
            Déposez le relevé de titres PDF, CSV ou Excel fourni par votre SGI (SGI-CI, Hudson &amp; Cie, BICI Bourse,
            SGI Bénin, EDC, Atlantique Finance…). Rien n’est enregistré tant que vous n’avez pas vérifié les lignes, et
            le fichier n’est pas conservé.
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className="ob-btn-gold" disabled={busy != null} onClick={() => inputRef.current?.click()}>
            {busy === "parse" ? "Lecture…" : "Choisir un fichier"}
          </button>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className={styles.fileInput}
            accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Relevé de titres PDF, CSV ou Excel"
            aria-describedby={`${inputId}-hint`}
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </div>
      </div>

      {error ? (
        <p className={styles.msg} style={{ color: "var(--c-red)" }} role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className={styles.msg} style={{ color: "var(--c-green)" }} role="status">
          {message}
        </p>
      ) : null}

      {preview ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className={styles.summary}>
            <strong>
              {rows.length} ligne(s) lue(s) · {rows.filter((row) => row.confidence === "haute" || row.confidence === "moyenne").length}{" "}
              reconnue(s)
            </strong>
            <span className={styles.meta}>
              {preview.issuer ?? "SGI non identifiée"}
              {statementDate ? ` · arrêté au ${statementDate.split("-").reverse().join("/")}` : ""}
              {" · "}
              {preview.layoutLabel}
            </span>
          </div>

          {preview.warnings.length > 0 ? (
            <ul className={styles.warnList}>
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <div className={styles.modes} role="radiogroup" aria-label="Mode d’import">
            <button
              type="button"
              className={styles.mode}
              role="radio"
              aria-checked={mode === "merge"}
              data-active={mode === "merge" ? "true" : "false"}
              onClick={() => setMode("merge")}
            >
              <strong>Fusionner</strong>
              <span>Ajoute les quantités aux positions déjà ouvertes et recalcule le PRU moyen.</span>
            </button>
            <button
              type="button"
              className={styles.mode}
              role="radio"
              aria-checked={mode === "replace"}
              data-active={mode === "replace" ? "true" : "false"}
              onClick={() => setMode("replace")}
            >
              <strong>Remplacer</strong>
              <span>
                Retire les {holdingCount} position(s) actuelle(s) de ce portefeuille, puis enregistre les lignes cochées.
                L’historique des mouvements déjà saisis est conservé.
              </span>
            </button>
          </div>

          <div className={styles.toolbar}>
            <button type="button" className="ob-btn-ghost" onClick={applyMissingPrices}>
              Utiliser le cours comme PRU manquant
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.caption}>Lignes extraites du relevé, à corriger avant enregistrement</caption>
              <thead>
                <tr>
                  <th>Inclure</th>
                  <th>Ligne du relevé</th>
                  <th>Société</th>
                  <th>Confiance</th>
                  <th>Quantité</th>
                  <th>PRU</th>
                  <th>Cours</th>
                  <th>Valorisation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const tone = !row.companyId || row.confidence === "aucune" ? "bad" : row.ambiguous || row.confidence === "faible" ? "warn" : "ok";
                  return (
                    <tr key={row.id} data-tone={tone}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.include}
                          aria-label={`Inclure ${row.label}`}
                          onChange={(event) => patch(row.id, { include: event.target.checked })}
                        />
                      </td>
                      <td>
                        <span className={styles.label}>{row.label}</span>
                        <span className={styles.raw}>{row.rawLine}</span>
                      </td>
                      <td>
                        <select
                          className={`ob-select ${styles.select}`}
                          aria-label={`Société pour ${row.label}`}
                          value={row.companyId}
                          onChange={(event) =>
                            patch(row.id, {
                              companyId: event.target.value,
                              confidence: event.target.value ? "haute" : "aucune",
                              ambiguous: false,
                              manual: true,
                            })
                          }
                        >
                          <option value="">— Choisir —</option>
                          {companies.map((company: StatementCompanyOption) => (
                            <option key={company.id} value={company.id}>
                              {company.ticker} — {company.name}
                            </option>
                          ))}
                        </select>
                        {row.companyId && companyById.get(row.companyId) ? (
                          <span className={styles.hint}>{row.manual ? "Corrigé manuellement" : companyById.get(row.companyId)?.name}</span>
                        ) : (
                          <span className={styles.hint}>Société non reconnue</span>
                        )}
                      </td>
                      <td>
                        <span className={styles.badge} data-confidence={row.manual ? "haute" : row.confidence}>
                          {row.manual ? "Corrigé" : CONFIDENCE_LABEL[row.confidence]}
                        </span>
                        {row.warnings[0] ? <span className={styles.hint}>{row.warnings[0]}</span> : null}
                      </td>
                      <td>
                        <input
                          className={`ob-input ob-num ${styles.numInput}`}
                          inputMode="decimal"
                          aria-label={`Quantité pour ${row.label}`}
                          value={row.quantity}
                          placeholder="N/D"
                          onChange={(event) => patch(row.id, { quantity: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={`ob-input ob-num ${styles.numInput}`}
                          inputMode="decimal"
                          aria-label={`PRU pour ${row.label}`}
                          value={row.avgBuyPrice}
                          placeholder="N/D"
                          onChange={(event) => patch(row.id, { avgBuyPrice: event.target.value })}
                        />
                        {row.lastPrice && !row.avgBuyPrice.trim() ? (
                          <button type="button" className={styles.linkish} onClick={() => applyLastPrice(row.id)}>
                            Utiliser le cours
                          </button>
                        ) : null}
                      </td>
                      <td className="ob-num">{formatFcfa(row.lastPrice)}</td>
                      <td className="ob-num">{formatFcfa(row.valuation)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.footer}>
            <label className={styles.dateField}>
              Date du relevé
              <input
                className="ob-input"
                type="date"
                value={statementDate}
                onChange={(event) => setStatementDate(event.target.value)}
              />
            </label>
            <div>
              {mode === "replace" ? (
                <label className={styles.check}>
                  <input type="checkbox" checked={replaceAck} onChange={(event) => setReplaceAck(event.target.checked)} />
                  <span>Je confirme le remplacement des positions actuelles de « {portfolioName} ».</span>
                </label>
              ) : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="ob-btn-ghost" onClick={resetReview} disabled={busy != null}>
                  Annuler
                </button>
                <button type="submit" className="ob-btn-gold" disabled={busy != null || included.length === 0}>
                  {busy === "save" ? "Enregistrement…" : `Enregistrer ${included.length} ligne(s)`}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : null}
    </section>
  );
}
