"use client";

import { useRef, useState } from "react";
import { C } from "@/lib/theme/colors";
import { notifyPortfolioChanged } from "@/lib/api/portfolio-trades-client";
import styles from "./PortfolioExcelIO.module.css";

type Props = {
  portfolioId: string;
  portfolioName: string;
};

export default function PortfolioExcelIO({ portfolioId, portfolioName }: Props) {
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
        throw new Error(json?.error ?? `Export impossible (${res.status})`);
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
      setMessage(`Export « ${portfolioName} » téléchargé.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export échoué.");
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
        throw new Error(json?.error ?? `Import impossible (${res.status})`);
      }
      const d = json.data as {
        created: number;
        updated: number;
        deleted: number;
        unknownTickers: string[];
        warnings: string[];
      };
      const parts = [
        mode === "replace" ? `${d.deleted} ligne(s) remplacée(s)` : null,
        d.created ? `${d.created} créée(s)` : null,
        d.updated ? `${d.updated} renforcée(s)` : null,
      ].filter(Boolean);
      let msg = `Import terminé — ${parts.join(" · ") || "aucune modification"}.`;
      if (d.unknownTickers?.length) {
        msg += ` Tickers inconnus ignorés : ${d.unknownTickers.join(", ")}.`;
      }
      if (d.warnings?.length) {
        msg += ` (${d.warnings.length} avertissement(s))`;
      }
      setMessage(msg);
      notifyPortfolioChanged(portfolioId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import échoué.");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onFilePicked(file: File | undefined) {
    if (!file) return;
    const replace = window.confirm(
      "Remplacer entièrement les positions actuelles par le fichier ?\n\nOK = remplacer\nAnnuler = fusionner (renforcer les lignes existantes)"
    );
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
          {busy === "export" ? "Export…" : "Exporter Excel"}
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          disabled={busy != null}
          onClick={() => inputRef.current?.click()}
        >
          {busy === "import" ? "Import…" : "Importer Excel"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className={styles.fileInput}
          aria-label="Fichier Excel du portefeuille"
          onChange={(e) => onFilePicked(e.target.files?.[0])}
        />
      </div>
      <p className={styles.hint} style={{ color: C.textDim }}>
        Export : dates en JJ/MM/AAAA + feuille Mouvements. Import « Remplacer » pour reconstituer à l&apos;identique.
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
