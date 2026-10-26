"use client";

import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { notifyPortfolioChanged } from "@/lib/api/portfolio-trades-client";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  errorFromPayload,
  formatIso,
  ignoreReasonLabel,
  localizeStatementNote,
} from "@/components/portfolio/portfolio-i18n";
import { parseFrNumber } from "@/lib/portfolio/sgi-statement/french-number";
import { STATEMENT_MAX_BYTES } from "@/lib/portfolio/sgi-statement/messages";
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
  /** Fichier déposé sur la page, en dehors de la zone. */
  incomingFile?: File | null;
  onIncomingFileHandled?: () => void;
  /** Remplace la ligne verte persistante : le parent ferme le panneau et affiche un toast. */
  onImported?: (message: string) => void;
  /** Surbrillance quand un fichier est glissé sur la page. */
  highlighted?: boolean;
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

function kindLabel(kind: InstrumentKind, t: ReturnType<typeof useI18n>["t"]): string {
  if (kind === "obligation") return t("portfolio.statement.kindBond");
  if (kind === "fcp") return t("portfolio.statement.kindFund");
  return t("portfolio.statement.kindAction");
}

function confidenceLabel(level: MatchConfidence, t: ReturnType<typeof useI18n>["t"]): string {
  if (level === "haute") return t("portfolio.statement.confidenceHigh");
  if (level === "moyenne") return t("portfolio.statement.confidenceMid");
  if (level === "faible") return t("portfolio.statement.confidenceLow");
  return t("portfolio.statement.confidenceNone");
}

function toInput(value: number | null): string {
  if (value == null) return "";
  if (Number.isInteger(value)) return String(value);
  return String(value).replace(".", ",");
}

function formatFcfa(value: number | null, format: ReturnType<typeof useI18n>["format"]): string {
  if (value == null) return "N/D";
  return format.fcfa(value);
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

function formatBytes(
  bytes: number,
  format: ReturnType<typeof useI18n>["format"],
  translate: ReturnType<typeof useI18n>["t"]
): string {
  if (bytes < 1024) return translate("portfolio.statement.bytes", { n: format.integer(bytes) });
  const kilo = bytes / 1024;
  if (kilo < 1024) {
    return translate("portfolio.statement.kilo", { n: format.decimal(kilo, kilo < 10 ? 1 : 0) });
  }
  const mega = kilo / 1024;
  return translate("portfolio.statement.mega", { n: format.decimal(mega, mega < 10 ? 1 : 0) });
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

export default function PortfolioStatementImport({
  portfolioId,
  portfolioName,
  holdingCount,
  incomingFile,
  onIncomingFileHandled,
  onImported,
  highlighted = false,
}: Props) {
  const { t, format, locale } = useI18n();
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
      setError(t("portfolio.statement.errors.UNSUPPORTED"));
      inflight.current = null;
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (isHeicFile(file)) {
      setSelected({ name: file.name, size: file.size });
      resetReview();
      setError(t("portfolio.statement.errors.HEIC"));
      inflight.current = null;
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const prepared = isRasterImage(file) ? await downscaleImage(file) : file;
    setSelected({ name: prepared.name, size: prepared.size });

    if (prepared.size <= 0) {
      resetReview();
      setError(t("portfolio.statement.errors.EMPTY"));
      inflight.current = null;
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (prepared.size > STATEMENT_MAX_BYTES) {
      resetReview();
      setError(t("portfolio.statement.errors.TOO_LARGE"));
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
      if (!res.ok || !json?.ok) throw new Error(errorFromPayload(t, json, t("portfolio.statement.readFailed")));
      const data = json.data as StatementPreview;
      setPreview(data);
      setRows(data.rows.map(toDraft));
      setStatementDate(data.statementDate ?? "");
      setMode("merge");
      setReplaceAck(false);
    } catch (err) {
      resetReview();
      setError(err instanceof Error ? err.message : t("portfolio.statement.readFailed"));
    } finally {
      setBusy(null);
      inflight.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const parseRef = useRef(parseFile);
  parseRef.current = parseFile;

  useEffect(() => {
    if (!incomingFile) return;
    void parseRef.current(incomingFile);
    onIncomingFileHandled?.();
  }, [incomingFile, onIncomingFileHandled]);

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
      setError(t("portfolio.statement.pickOne"));
      return;
    }
    if (blocked.length > 0) {
      setError(t("portfolio.statement.completeRows"));
      return;
    }
    if (mode === "replace" && !replaceAck) {
      setError(t("portfolio.statement.confirmReplace"));
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
      if (!res.ok || !json?.ok) throw new Error(errorFromPayload(t, json, t("portfolio.statement.saveFailed")));
      const data = json.data as { created: number; updated: number; deleted: number; skipped?: number };
      const parts = [
        mode === "replace" ? t("portfolio.statement.removed", { count: data.deleted }) : null,
        data.created ? t("portfolio.statement.created", { count: data.created }) : null,
        data.updated ? t("portfolio.statement.reinforced", { count: data.updated }) : null,
        data.skipped ? t("portfolio.statement.skipped", { count: data.skipped }) : null,
      ].filter(Boolean);
      const done = t("portfolio.statement.imported", {
        name: portfolioName,
        parts: parts.join(" · ") || t("portfolio.statement.noChange"),
      });
      if (onImported) onImported(done);
      else setMessage(done);
      resetReview();
      dismissFile();
      notifyPortfolioChanged(portfolioId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("portfolio.statement.saveFailed"));
    } finally {
      setBusy(null);
    }
  }

  const phase = message && !preview ? "done" : preview ? "review" : "upload";

  return (
    <section className={styles.card} data-testid="sgi-import" aria-labelledby={`${inputId}-title`}>
      <ol className={styles.steps}>
        <li data-state={phase === "upload" ? "current" : "done"}>{t("portfolio.statement.stepDrop")}</li>
        <li data-state={phase === "review" ? "current" : phase === "done" ? "done" : "todo"}>{t("portfolio.statement.stepReview")}</li>
        <li data-state={phase === "done" ? "current" : "todo"}>{t("portfolio.statement.stepSave")}</li>
      </ol>

      <div className={styles.intro}>
        <h3 id={`${inputId}-title`} className={styles.heading}>
          {t("portfolio.statement.heading")}
        </h3>
        <p className={styles.privacy} id={`${inputId}-hint`}>
          {t("portfolio.statement.privacy")}
        </p>
      </div>

      <div
        className={styles.drop}
        data-testid="sgi-drop"
        data-active={dragOver || highlighted ? "true" : "false"}
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
            aria-label={t("portfolio.statement.dropAria")}
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
            <p className={styles.touchCue}>{t("portfolio.statement.tap")}</p>
            <p className={styles.headline}>
              {busy === "parse"
                ? t("portfolio.statement.reading")
                : dragOver || highlighted
                  ? t("portfolio.statement.release")
                  : t("portfolio.statement.drop")}
            </p>
            {busy !== "parse" && !dragOver && !highlighted ? <p className={styles.or}>{t("portfolio.statement.or")}</p> : null}
            {busy !== "parse" && !dragOver && !highlighted ? (
              <span className={`ob-btn-gold ${styles.choose}`}>{t("portfolio.statement.choose")}</span>
            ) : null}
            <ul className={styles.formats} id={`${inputId}-formats`}>
              <li>PDF</li>
              <li>Excel .xlsx</li>
              <li>Excel .xls</li>
              <li>CSV</li>
              <li>JPEG</li>
              <li>PNG</li>
              <li>WEBP</li>
              <li data-kind="limit">{t("portfolio.statement.max")}</li>
            </ul>
          </div>
        </div>
        {selected ? (
          <div className={styles.fileChip}>
            <span className={styles.fileName}>{selected.name}</span>
            <span className={styles.fileMeta}>
              {formatBytes(selected.size, format, t)}
              {busy === "parse" ? t("portfolio.statement.readingShort") : ""}
            </span>
            <button type="button" className={`ob-btn-ghost ${styles.remove}`} onClick={clearSelection} disabled={busy != null}>
              {t("portfolio.statement.remove")}
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
              {t("portfolio.statement.positions", { count: rows.length })}
              {preview.ignoredCount > 0 ? ` · ${t("portfolio.statement.ignored", { count: preview.ignoredCount })}` : ""}
              {" · "}
              {t("portfolio.statement.recognized", {
                count: rows.filter((row) => row.tracked && (row.confidence === "haute" || row.confidence === "moyenne")).length,
              })}
            </strong>
            <span className={styles.meta}>
              {preview.issuer ?? t("portfolio.statement.issuerNd")}
              {statementDate ? ` · ${t("portfolio.statement.asOf", { date: formatIso(format, statementDate) })}` : ""}
              {" · "}
              {localizeStatementNote(preview.layoutLabel, locale, t)}
            </span>
          </div>

          {preview.warnings.length > 0 ? (
            <ul className={styles.warnList}>
              {preview.warnings.map((warning) => (
                <li key={warning}>{localizeStatementNote(warning, locale, t)}</li>
              ))}
            </ul>
          ) : null}

          {preview.ignoredCount > 0 ? (
            <details className={styles.ignored}>
              <summary>
                {t("portfolio.statement.ignored", { count: preview.ignoredCount })}
                {preview.ignored.length < preview.ignoredCount
                  ? t("portfolio.statement.shown", { count: preview.ignored.length })
                  : ""}
              </summary>
              <ul>
                {preview.ignored.map((line, index) => (
                  <li key={`${line.reason}-${index}`}>
                    <strong>{ignoreReasonLabel(line.reason, t)}</strong>
                    <span>{line.raw}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className={styles.modes} role="radiogroup" aria-label={t("portfolio.statement.modeAria")}>
            <button
              type="button"
              className={styles.mode}
              role="radio"
              aria-checked={mode === "merge"}
              data-active={mode === "merge" ? "true" : "false"}
              onClick={() => setMode("merge")}
            >
              <strong>{t("portfolio.statement.merge")}</strong>
              <span>{t("portfolio.statement.mergeHelp")}</span>
            </button>
            <button
              type="button"
              className={styles.mode}
              role="radio"
              aria-checked={mode === "replace"}
              data-active={mode === "replace" ? "true" : "false"}
              onClick={() => setMode("replace")}
            >
              <strong>{t("portfolio.statement.replace")}</strong>
              <span>{t("portfolio.statement.replaceHelp", { count: holdingCount })}</span>
            </button>
          </div>

          <div className={styles.toolbar}>
            <button type="button" className="ob-btn-ghost" onClick={applyMissingPrices}>
              {t("portfolio.statement.useMissing")}
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.caption}>{t("portfolio.statement.caption")}</caption>
              <thead>
                <tr>
                  <th>{t("portfolio.statement.include")}</th>
                  <th>{t("portfolio.statement.kind")}</th>
                  <th>{t("portfolio.statement.line")}</th>
                  <th>{t("portfolio.statement.company")}</th>
                  <th>{t("portfolio.statement.confidence")}</th>
                  <th>{t("portfolio.statement.quantity")}</th>
                  <th>PRU</th>
                  <th>{t("portfolio.statement.date")}</th>
                  <th>{t("portfolio.statement.price")}</th>
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
                          aria-label={t("portfolio.statement.includeAria", { label: row.label })}
                          onChange={(event) => patch(row.id, { include: event.target.checked })}
                        />
                      </td>
                      <td>
                        <span className={styles.kind}>{kindLabel(row.instrumentKind, t)}</span>
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
                              aria-label={t("portfolio.statement.nameAria", { label: row.label })}
                              value={row.label}
                              onChange={(event) => patch(row.id, { label: event.target.value })}
                            />
                            <input
                              className="ob-input"
                              aria-label={t("portfolio.statement.isinAria", { label: row.label })}
                              value={row.isin}
                              placeholder={t("portfolio.statement.isinPh")}
                              onChange={(event) => patch(row.id, { isin: event.target.value })}
                            />
                            {row.instrumentKind === "obligation" ? (
                              <>
                                <select
                                  className="ob-select"
                                  aria-label={t("portfolio.statement.unitAria", { label: row.label })}
                                  value={row.priceMode}
                                  onChange={(event) =>
                                    patch(row.id, { priceMode: event.target.value === "PERCENT" ? "PERCENT" : "FCFA" })
                                  }
                                >
                                  <option value="FCFA">{t("portfolio.statement.priceFcfa")}</option>
                                  <option value="PERCENT">{t("portfolio.statement.pricePercent")}</option>
                                </select>
                                <input
                                  className="ob-input ob-num"
                                  inputMode="decimal"
                                  aria-label={t("portfolio.statement.nominalAria", { label: row.label })}
                                  value={row.nominal}
                                  placeholder={t("portfolio.statement.nominalPh")}
                                  onChange={(event) => patch(row.id, { nominal: event.target.value })}
                                />
                                <input
                                  className="ob-input ob-num"
                                  inputMode="decimal"
                                  aria-label={t("portfolio.statement.couponAria", { label: row.label })}
                                  value={row.couponRate}
                                  placeholder={t("portfolio.statement.couponPh")}
                                  onChange={(event) => patch(row.id, { couponRate: event.target.value })}
                                />
                                <input
                                  className="ob-input"
                                  type="date"
                                  aria-label={t("portfolio.statement.maturityAria", { label: row.label })}
                                  value={row.maturityDate}
                                  onChange={(event) => patch(row.id, { maturityDate: event.target.value })}
                                />
                                <input
                                  className="ob-input ob-num"
                                  inputMode="decimal"
                                  aria-label={t("portfolio.statement.lastPriceAria", { label: row.label })}
                                  value={row.latestValue}
                                  placeholder={t("portfolio.statement.lastPricePh")}
                                  onChange={(event) => patch(row.id, { latestValue: event.target.value })}
                                />
                              </>
                            ) : (
                              <>
                                <input
                                  className="ob-input"
                                  aria-label={t("portfolio.statement.managerAria", { label: row.label })}
                                  value={row.manager}
                                  placeholder={t("portfolio.statement.managerPh")}
                                  onChange={(event) => patch(row.id, { manager: event.target.value })}
                                />
                                <input
                                  className="ob-input ob-num"
                                  inputMode="decimal"
                                  aria-label={t("portfolio.statement.navAria", { label: row.label })}
                                  value={row.latestValue}
                                  placeholder={t("portfolio.statement.navPh")}
                                  onChange={(event) => patch(row.id, { latestValue: event.target.value })}
                                />
                              </>
                            )}
                            <span className={styles.hint}>
                              {t("portfolio.statement.savedAs", { kind: kindLabel(row.instrumentKind, t).toLowerCase() })}
                            </span>
                          </div>
                        ) : (
                          <>
                            <select
                              className={`ob-select ${styles.select}`}
                              aria-label={t("portfolio.statement.companyAria", { label: row.label })}
                              value={row.companyId}
                              onChange={(event) =>
                                patch(row.id, {
                                  companyId: event.target.value,
                                  confidence: event.target.value ? "haute" : "aucune",
                                  confidenceWhy: event.target.value
                                    ? t("portfolio.statement.chosen")
                                    : t("portfolio.statement.noneChosen"),
                                  ambiguous: false,
                                  manual: true,
                                })
                              }
                            >
                              <option value="">{t("portfolio.statement.chooseCompany")}</option>
                              {companies.map((company: StatementCompanyOption) => (
                                <option key={company.id} value={company.id}>
                                  {company.ticker} — {company.name}
                                </option>
                              ))}
                            </select>
                            {row.companyId && companyById.get(row.companyId) ? (
                              <span className={styles.hint}>
                                {row.manual ? t("portfolio.statement.manualFix") : companyById.get(row.companyId)?.name}
                              </span>
                            ) : (
                              <span className={styles.hint}>{t("portfolio.statement.unknownCompany")}</span>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        <span className={styles.badge} data-confidence={other || row.manual ? "haute" : row.confidence}>
                          {other ? t("portfolio.statement.identified") : row.manual ? t("portfolio.statement.corrected") : confidenceLabel(row.confidence, t)}
                        </span>
                        {row.confidenceWhy ? (
                          <span className={styles.hint}>{localizeStatementNote(row.confidenceWhy, locale, t)}</span>
                        ) : null}
                        {row.warnings
                          .filter((warning) => warning !== row.confidenceWhy)
                          .slice(0, 1)
                          .map((warning) => (
                            <span key={warning} className={styles.hint}>
                              {localizeStatementNote(warning, locale, t)}
                            </span>
                          ))}
                      </td>
                      <td>
                        <input
                          className={`ob-input ob-num ${styles.numInput}`}
                          inputMode="decimal"
                          aria-label={t("portfolio.statement.qtyAria", { label: row.label })}
                          value={row.quantity}
                          placeholder="N/D"
                          onChange={(event) => patch(row.id, { quantity: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={`ob-input ob-num ${styles.numInput}`}
                          inputMode="decimal"
                          aria-label={t("portfolio.statement.pruAria", { label: row.label })}
                          value={row.avgBuyPrice}
                          placeholder="N/D"
                          onChange={(event) => patch(row.id, { avgBuyPrice: event.target.value })}
                        />
                        {row.lastPrice && !row.avgBuyPrice.trim() ? (
                          <button type="button" className={styles.linkish} onClick={() => applyLastPrice(row.id)}>
                            {t("portfolio.statement.usePrice")}
                          </button>
                        ) : null}
                      </td>
                      <td>
                        <input
                          className={`ob-input ${styles.dateInput}`}
                          type="date"
                          aria-label={t("portfolio.statement.buyDateAria", { label: row.label })}
                          value={row.tradeDate}
                          onChange={(event) => patch(row.id, { tradeDate: event.target.value })}
                        />
                        {!row.tradeDate ? <span className={styles.hint}>N/D</span> : null}
                      </td>
                      <td className="ob-num">{formatFcfa(row.lastPrice, format)}</td>
                      <td>
                        <button type="button" className={`ob-btn-ghost ${styles.rowRemove}`} onClick={() => removeRow(row.id)}>
                          {t("portfolio.statement.remove")}
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
              {t("portfolio.statement.statementDate")}
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
                  <span>{t("portfolio.statement.confirmBox", { name: portfolioName })}</span>
                </label>
              ) : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="ob-btn-ghost" onClick={clearSelection} disabled={busy != null}>
                  {t("common.cancel")}
                </button>
                <button type="submit" className="ob-btn-gold" disabled={busy != null || included.length === 0}>
                  {busy === "save" ? t("portfolio.statement.saving") : t("portfolio.statement.saveCount", { count: included.length })}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : null}
    </section>
  );
}
