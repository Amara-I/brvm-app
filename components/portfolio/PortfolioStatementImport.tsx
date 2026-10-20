"use client";

import { useId, useMemo, useRef, useState, type DragEvent } from "react";
import { notifyPortfolioChanged } from "@/lib/api/portfolio-trades-client";
import { parseFrNumber } from "@/lib/portfolio/sgi-statement/french-number";
import { STATEMENT_ERRORS, STATEMENT_MAX_BYTES } from "@/lib/portfolio/sgi-statement/messages";
import { IGNORE_REASON_LABEL } from "@/lib/portfolio/sgi-statement/noise";
import type {
  InstrumentKind,
  MatchConfidence,
  StatementCompanyOption,
  StatementPreview,
  StatementRowDraft,
} from "@/lib/portfolio/sgi-statement/types";
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
  tradeDate: string;
  lastPrice: number | null;
  valuation: number | null;
  companyId: string;
  confidence: MatchConfidence;
  ambiguous: boolean;
  warnings: string[];
  confidenceWhy: string;
  manual: boolean;
  instrumentKind: InstrumentKind;
  tracked: boolean;
  isin: string;
  nominal: string;
  couponRate: string;
  maturityDate: string;
  manager: string;
  latestValue: string;
  priceMode: "FCFA" | "PERCENT";
};

const KIND_LABEL: Record<InstrumentKind, string> = {
  action: "Action",
  obligation: "Obligation",
  fcp: "FCP",
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

const STATEMENT_EXTENSIONS = [".pdf", ".csv", ".xlsx", ".xls", ".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif"];
const ACCEPT =
  ".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.heic,.heif,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg,image/webp,image/heic,image/heif";

function isStatementFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return STATEMENT_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif") || mime.includes("heic") || mime.includes("heif");
}

function isRasterImage(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/webp" || /\.(png|jpe?g|webp)$/.test(name);
}

/** Réduit une photo avant envoi (Hobby : corps ~4,5 Mo, lecture plus rapide). */
async function downscaleImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "releve";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const kilo = bytes / 1024;
  if (kilo < 1024) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: kilo < 10 ? 1 : 0 }).format(kilo)} Ko`;
  }
  const mega = bytes / (1024 * 1024);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: mega < 10 ? 1 : 0 }).format(mega)} Mo`;
}

function includeByDefault(row: StatementRowDraft): boolean {
  if (row.tracked === false) return false;
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
    tradeDate: row.tradeDate ?? "",
    lastPrice: row.lastPrice,
    valuation: row.valuation,
    companyId: row.match.companyId ?? "",
    confidence: row.match.confidence,
    ambiguous: row.match.ambiguous,
    warnings: row.warnings,
    confidenceWhy: row.confidenceWhy ?? "",
    manual: false,
    instrumentKind: row.instrumentKind ?? "action",
    tracked: row.tracked !== false,
    isin: row.isin ?? "",
    nominal: toInput(row.nominal),
    couponRate: toInput(row.couponRate),
    maturityDate: row.maturityDate ?? "",
    manager: row.manager ?? "",
    latestValue: toInput(row.lastPrice),
    priceMode: row.priceMode ?? "FCFA",
  };
}

export default function PortfolioStatementImport({ portfolioId, portfolioName, holdingCount }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const inflight = useRef<string | null>(null);
  const dropped = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<"parse" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ name: string; size: number } | null>(null);
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

  function dismissFile() {
    setSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function clearSelection() {
    resetReview();
    dismissFile();
    setError(null);
    setMessage(null);
  }

  function endDrag() {
    dragDepth.current = 0;
    setDragOver(false);
  }

  function onDragEnter(event: DragEvent) {
    event.preventDefault();
    if (busy != null) return;
    dragDepth.current += 1;
    setDragOver(true);
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = busy != null ? "none" : "copy";
  }

  function onDragLeave(event: DragEvent) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    endDrag();
    if (busy != null) return;
    dropped.current = true;
    void parseFile(event.dataTransfer.files?.[0]);
  }

  async function parseFile(file: File | undefined) {
    if (!file || busy != null) return;
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (inflight.current === key) return;
    inflight.current = key;
    setError(null);
    setMessage(null);

    if (!isStatementFile(file)) {
      setSelected({ name: file.name, size: file.size });
      resetReview();
      setError(STATEMENT_ERRORS.UNSUPPORTED);
      inflight.current = null;
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (isHeicFile(file)) {
      setSelected({ name: file.name, size: file.size });
      resetReview();
      setError(STATEMENT_ERRORS.HEIC);
      inflight.current = null;
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const prepared = isRasterImage(file) ? await downscaleImage(file) : file;
    setSelected({ name: prepared.name, size: prepared.size });

    if (prepared.size <= 0) {
      resetReview();
      setError(STATEMENT_ERRORS.EMPTY);
      inflight.current = null;
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (prepared.size > STATEMENT_MAX_BYTES) {
      resetReview();
      setError(STATEMENT_ERRORS.TOO_LARGE);
      inflight.current = null;
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy("parse");
    try {
      const body = new FormData();
      body.append("file", prepared);
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
      inflight.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function patch(id: string, partial: Partial<Draft>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...partial } : row)));
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
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
    const numbersMissing = quantity == null || quantity <= 0 || price == null || price <= 0;
    if (row.instrumentKind !== "action") return numbersMissing || !row.label.trim();
    return !row.companyId || numbersMissing;
  });

  async function save() {
    setError(null);
    setMessage(null);
    if (included.length === 0) {
      setError("Cochez au moins une ligne à enregistrer.");
      return;
    }
    if (blocked.length > 0) {
      setError("Complétez la quantité et le prix des lignes cochées. Une action doit aussi avoir une société.");
      return;
    }
    if (mode === "replace" && !replaceAck) {
      setError("Cochez la confirmation pour remplacer les positions actuelles.");
      return;
    }

    setBusy("save");
    try {
      const actions = included.filter((row) => row.instrumentKind === "action");
      const others = included.filter((row) => row.instrumentKind !== "action");
      const res = await fetch(`/api/portfolio/${portfolioId}/import-statement/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          statementDate: statementDate || null,
          issuer: preview?.issuer ?? null,
          rows: actions.map((row) => ({
            companyId: row.companyId,
            quantity: parseFrNumber(row.quantity),
            avgBuyPrice: parseFrNumber(row.avgBuyPrice),
            buyDate: /^\d{4}-\d{2}-\d{2}$/.test(row.tradeDate) ? row.tradeDate : null,
          })),
          otherRows: others.map((row) => {
            const nominal = parseFrNumber(row.nominal);
            const couponRate = parseFrNumber(row.couponRate);
            const latestValue = parseFrNumber(row.latestValue);
            const isin = row.isin.replace(/\s+/g, "").toUpperCase();
            return {
              kind: row.instrumentKind === "fcp" ? "FCP" : "OBLIGATION",
              name: row.label.trim(),
              isin: /^[A-Z]{2}[A-Z0-9]{10}$/.test(isin) ? isin : null,
              manager: row.manager.trim() || null,
              quantity: parseFrNumber(row.quantity),
              avgBuyPrice: parseFrNumber(row.avgBuyPrice),
              priceMode: row.instrumentKind === "obligation" ? row.priceMode : "FCFA",
              nominal: nominal != null && nominal > 0 ? nominal : null,
              couponRate: couponRate != null && couponRate >= 0 ? couponRate : null,
              maturityDate: /^\d{4}-\d{2}-\d{2}$/.test(row.maturityDate) ? row.maturityDate : null,
              buyDate: /^\d{4}-\d{2}-\d{2}$/.test(row.tradeDate) ? row.tradeDate : null,
              latestValue: latestValue != null && latestValue > 0 ? latestValue : null,
            };
          }),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Enregistrement impossible.");
      const data = json.data as { created: number; updated: number; deleted: number; skipped?: number };
      const parts = [
        mode === "replace" ? `${data.deleted} position(s) retirée(s)` : null,
        data.created ? `${data.created} créée(s)` : null,
        data.updated ? `${data.updated} renforcée(s)` : null,
        data.skipped ? `${data.skipped} non fusionnée(s) (unité de prix différente)` : null,
      ].filter(Boolean);
      setMessage(`Relevé importé dans « ${portfolioName} » — ${parts.join(" · ") || "aucune modification"}.`);
      resetReview();
      dismissFile();
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

      <div className={styles.intro}>
        <h3 id={`${inputId}-title`} className={styles.heading}>
          Importer un relevé SGI
        </h3>
        <p className={styles.privacy} id={`${inputId}-hint`}>
          Rien n’est enregistré tant que vous n’avez pas vérifié les lignes, et le fichier n’est pas conservé.
        </p>
      </div>

      <div
        className={styles.drop}
        data-testid="sgi-drop"
        data-active={dragOver ? "true" : "false"}
        data-state={busy === "parse" ? "parsing" : error ? "error" : selected ? "selected" : "idle"}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={endDrag}
      >
        <div className={styles.dropHit}>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className={styles.fileHit}
            accept={ACCEPT}
            aria-label="Glissez-déposez votre relevé ici, ou choisissez un PDF, un Excel, un CSV ou une image"
            aria-describedby={`${inputId}-hint ${inputId}-formats`}
            disabled={busy != null}
            onChange={(event) => {
              if (dropped.current) {
                dropped.current = false;
                event.target.value = "";
                return;
              }
              void parseFile(event.target.files?.[0]);
            }}
          />
          <div className={styles.dropBody}>
            <div className={styles.mark} aria-hidden="true">
              {busy === "parse" ? (
                <span className={styles.spinner} />
              ) : (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M8 8l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <p className={styles.touchCue}>Appuyez pour choisir votre relevé</p>
            <p className={styles.headline}>
              {busy === "parse"
                ? "Lecture du relevé…"
                : dragOver
                  ? "Relâchez pour analyser le relevé"
                  : "Glissez-déposez votre relevé ici"}
            </p>
            {busy !== "parse" && !dragOver ? <p className={styles.or}>ou</p> : null}
            {busy !== "parse" && !dragOver ? <span className={`ob-btn-gold ${styles.choose}`}>Choisir un fichier</span> : null}
            <ul className={styles.formats} id={`${inputId}-formats`}>
              <li>PDF</li>
              <li>Excel .xlsx</li>
              <li>Excel .xls</li>
              <li>CSV</li>
              <li>JPEG</li>
              <li>PNG</li>
              <li>WEBP</li>
              <li data-kind="limit">4 Mo max</li>
            </ul>
          </div>
        </div>
        {selected ? (
          <div className={styles.fileChip}>
            <span className={styles.fileName}>{selected.name}</span>
            <span className={styles.fileMeta}>
              {formatBytes(selected.size)}
              {busy === "parse" ? " · Lecture en cours…" : ""}
            </span>
            <button type="button" className={`ob-btn-ghost ${styles.remove}`} onClick={clearSelection} disabled={busy != null}>
              Retirer
            </button>
          </div>
        ) : null}
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
              {rows.length} position(s)
              {preview.ignoredCount > 0 ? ` · ${preview.ignoredCount} ligne(s) ignorée(s)` : ""}
              {" · "}
              {rows.filter((row) => row.tracked && (row.confidence === "haute" || row.confidence === "moyenne")).length} reconnue(s)
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

          {preview.ignoredCount > 0 ? (
            <details className={styles.ignored}>
              <summary>
                {preview.ignoredCount} ligne(s) ignorée(s)
                {preview.ignored.length < preview.ignoredCount ? ` — ${preview.ignored.length} affichée(s)` : ""}
              </summary>
              <ul>
                {preview.ignored.map((line, index) => (
                  <li key={`${line.reason}-${index}`}>
                    <strong>{IGNORE_REASON_LABEL[line.reason]}</strong>
                    <span>{line.raw}</span>
                  </li>
                ))}
              </ul>
            </details>
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
              <caption className={styles.caption}>Une position par titre, à corriger avant enregistrement</caption>
              <thead>
                <tr>
                  <th>Inclure</th>
                  <th>Type</th>
                  <th>Ligne du relevé</th>
                  <th>Société</th>
                  <th>Confiance</th>
                  <th>Quantité</th>
                  <th>PRU</th>
                  <th>Date</th>
                  <th>Cours</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const other = row.instrumentKind !== "action";
                  const tone = other
                    ? "ok"
                    : !row.companyId || row.confidence === "aucune"
                      ? "bad"
                      : row.ambiguous || row.confidence === "faible"
                        ? "warn"
                        : "ok";
                  return (
                    <tr key={row.id} data-tone={tone} data-kind={row.instrumentKind}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.include}
                          aria-label={`Inclure ${row.label}`}
                          onChange={(event) => patch(row.id, { include: event.target.checked })}
                        />
                      </td>
                      <td>
                        <span className={styles.kind}>{KIND_LABEL[row.instrumentKind]}</span>
                      </td>
                      <td>
                        <span className={styles.label}>{row.label}</span>
                        <span className={styles.raw}>{row.rawLine}</span>
                      </td>
                      <td>
                        {other ? (
                          <div className={styles.instrumentFields}>
                            <input
                              className="ob-input"
                              aria-label={`Nom pour ${row.label}`}
                              value={row.label}
                              onChange={(event) => patch(row.id, { label: event.target.value })}
                            />
                            <input
                              className="ob-input"
                              aria-label={`ISIN pour ${row.label}`}
                              value={row.isin}
                              placeholder="ISIN — N/D"
                              onChange={(event) => patch(row.id, { isin: event.target.value })}
                            />
                            {row.instrumentKind === "obligation" ? (
                              <>
                                <select
                                  className="ob-select"
                                  aria-label={`Unité du prix pour ${row.label}`}
                                  value={row.priceMode}
                                  onChange={(event) =>
                                    patch(row.id, { priceMode: event.target.value === "PERCENT" ? "PERCENT" : "FCFA" })
                                  }
                                >
                                  <option value="FCFA">Prix en FCFA</option>
                                  <option value="PERCENT">% du nominal</option>
                                </select>
                                <input
                                  className="ob-input ob-num"
                                  inputMode="decimal"
                                  aria-label={`Nominal pour ${row.label}`}
                                  value={row.nominal}
                                  placeholder="Nominal — N/D"
                                  onChange={(event) => patch(row.id, { nominal: event.target.value })}
                                />
                                <input
                                  className="ob-input ob-num"
                                  inputMode="decimal"
                                  aria-label={`Coupon pour ${row.label}`}
                                  value={row.couponRate}
                                  placeholder="Coupon % — N/D"
                                  onChange={(event) => patch(row.id, { couponRate: event.target.value })}
                                />
                                <input
                                  className="ob-input"
                                  type="date"
                                  aria-label={`Échéance pour ${row.label}`}
                                  value={row.maturityDate}
                                  onChange={(event) => patch(row.id, { maturityDate: event.target.value })}
                                />
                                <input
                                  className="ob-input ob-num"
                                  inputMode="decimal"
                                  aria-label={`Dernier prix connu pour ${row.label}`}
                                  value={row.latestValue}
                                  placeholder="Dernier prix — N/D"
                                  onChange={(event) => patch(row.id, { latestValue: event.target.value })}
                                />
                              </>
                            ) : (
                              <>
                                <input
                                  className="ob-input"
                                  aria-label={`Société de gestion pour ${row.label}`}
                                  value={row.manager}
                                  placeholder="Société de gestion — N/D"
                                  onChange={(event) => patch(row.id, { manager: event.target.value })}
                                />
                                <input
                                  className="ob-input ob-num"
                                  inputMode="decimal"
                                  aria-label={`Dernière VL pour ${row.label}`}
                                  value={row.latestValue}
                                  placeholder="Dernière VL — N/D"
                                  onChange={(event) => patch(row.id, { latestValue: event.target.value })}
                                />
                              </>
                            )}
                            <span className={styles.hint}>Enregistrée comme {KIND_LABEL[row.instrumentKind].toLowerCase()}</span>
                          </div>
                        ) : (
                          <>
                            <select
                              className={`ob-select ${styles.select}`}
                              aria-label={`Société pour ${row.label}`}
                              value={row.companyId}
                              onChange={(event) =>
                                patch(row.id, {
                                  companyId: event.target.value,
                                  confidence: event.target.value ? "haute" : "aucune",
                                  confidenceWhy: event.target.value
                                    ? "Société choisie manuellement."
                                    : "Aucune société choisie.",
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
                              <span className={styles.hint}>
                                {row.manual ? "Corrigé manuellement" : companyById.get(row.companyId)?.name}
                              </span>
                            ) : (
                              <span className={styles.hint}>Société non reconnue</span>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        <span className={styles.badge} data-confidence={other || row.manual ? "haute" : row.confidence}>
                          {other ? "Identifiée" : row.manual ? "Corrigé" : CONFIDENCE_LABEL[row.confidence]}
                        </span>
                        {row.confidenceWhy ? <span className={styles.hint}>{row.confidenceWhy}</span> : null}
                        {row.warnings
                          .filter((warning) => warning !== row.confidenceWhy)
                          .slice(0, 1)
                          .map((warning) => (
                            <span key={warning} className={styles.hint}>
                              {warning}
                            </span>
                          ))}
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
                      <td>
                        <input
                          className={`ob-input ${styles.dateInput}`}
                          type="date"
                          aria-label={`Date d’achat pour ${row.label}`}
                          value={row.tradeDate}
                          onChange={(event) => patch(row.id, { tradeDate: event.target.value })}
                        />
                        {!row.tradeDate ? <span className={styles.hint}>N/D</span> : null}
                      </td>
                      <td className="ob-num">{formatFcfa(row.lastPrice)}</td>
                      <td>
                        <button type="button" className={`ob-btn-ghost ${styles.rowRemove}`} onClick={() => removeRow(row.id)}>
                          Retirer
                        </button>
                      </td>
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
                <button type="button" className="ob-btn-ghost" onClick={clearSelection} disabled={busy != null}>
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
