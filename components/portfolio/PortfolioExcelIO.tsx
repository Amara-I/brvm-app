"use client";

import { useRef, useState } from "react";
import { C } from "@/lib/theme/colors";
import { notifyPortfolioChanged } from "@/lib/api/portfolio-trades-client";
import { useI18n } from "@/components/i18n/I18nProvider";
import { showPortfolioApiError } from "@/components/portfolio/portfolio-i18n";
import styles from "./PortfolioExcelIO.module.css";

type Props = {
  portfolioId: string;
  portfolioName: string;
  /** Remplace le message vert persistant. */
  onDone?: (message: string) => void;
};

export default function PortfolioExcelIO({ portfolioId, portfolioName, onDone }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy("export");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/portfolio/${portfolioId}/export`, { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(showPortfolioApiError(t, json?.error, t("portfolio.excel.exportStatus", { status: res.status })));
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const fileName = match?.[1] ?? `OuestBourse_Portefeuille.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      const done = t("portfolio.excel.downloaded", { name: portfolioName });
      if (onDone) onDone(done);
      else setMessage(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("portfolio.excel.failedExport"));
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(file: File, mode: "merge" | "replace") {
    setBusy("import");
    setError(null);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/portfolio/${portfolioId}/import?mode=${mode}`, {
        method: "POST",
        body,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(showPortfolioApiError(t, json?.error, t("portfolio.excel.importStatus", { status: res.status })));
      }
      const d = json.data as {
        created: number;
        updated: number;
        deleted: number;
        unknownTickers: string[];
        warnings: string[];
      };
      const parts = [
        mode === "replace" ? t("portfolio.excel.replaced", { count: d.deleted }) : null,
        d.created ? t("portfolio.excel.created", { count: d.created }) : null,
        d.updated ? t("portfolio.excel.reinforced", { count: d.updated }) : null,
      ].filter(Boolean);
      let msg = t("portfolio.excel.done", { parts: parts.join(" · ") || t("portfolio.excel.none") });
      if (d.unknownTickers?.length) {
        msg += t("portfolio.excel.unknown", { list: d.unknownTickers.join(", ") });
      }
      if (d.warnings?.length) {
        msg += t("portfolio.excel.warnings", { count: d.warnings.length });
      }
      if (onDone) onDone(msg);
      else setMessage(msg);
      notifyPortfolioChanged(portfolioId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("portfolio.excel.failedImport"));
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onFilePicked(file: File | undefined) {
    if (!file) return;
    const replace = window.confirm(t("portfolio.excel.confirm"));
    void handleImport(file, replace ? "replace" : "merge");
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.btn}
          disabled={busy != null}
          onClick={() => void handleExport()}
        >
          {busy === "export" ? t("portfolio.excel.exportBusy") : t("portfolio.excel.export")}
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          disabled={busy != null}
          onClick={() => inputRef.current?.click()}
        >
          {busy === "import" ? t("portfolio.excel.importBusy") : t("portfolio.excel.import")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className={styles.fileInput}
          aria-label={t("portfolio.excel.fileAria")}
          onChange={(e) => onFilePicked(e.target.files?.[0])}
        />
      </div>
      <p className={styles.hint} style={{ color: C.textDim }}>
        {t("portfolio.excel.hint")}
      </p>
      {message ? (
        <p className={styles.msg} style={{ color: C.green }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p className={styles.msg} style={{ color: C.red }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
