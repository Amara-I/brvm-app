"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import PortfolioExcelIO from "@/components/portfolio/PortfolioExcelIO";
import PortfolioStatementImport from "@/components/portfolio/PortfolioStatementImport";
import styles from "./PortfolioTransfer.module.css";

type Props = {
  portfolioId: string;
  portfolioName: string;
  holdingCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incomingFile?: File | null;
  onIncomingFileHandled?: () => void;
  /** Fichier glissé sur la page : ouvre et met en avant la zone de dépôt. */
  highlighted?: boolean;
  children: (button: ReactNode) => ReactNode;
};

function fileDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export default function PortfolioTransfer({
  portfolioId,
  portfolioName,
  holdingCount,
  open,
  onOpenChange,
  incomingFile,
  onIncomingFileHandled,
  highlighted = false,
  children,
}: Props) {
  const { t } = useI18n();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const apply = () => setSheet(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
      buttonRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open || !sheet) return;
    panelRef.current?.querySelector<HTMLButtonElement>("[data-sheet-close]")?.focus();
  }, [open, sheet]);

  useEffect(() => {
    if (!open || !highlighted) return;
    panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, highlighted]);

  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    if (open) node.removeAttribute("inert");
    else node.setAttribute("inert", "");
  }, [open]);

  function finish(message: string) {
    setToast(message);
    close();
  }

  const button = (
    <button
      ref={buttonRef}
      type="button"
      className={styles.button}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => onOpenChange(!open)}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 16V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 9l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {t("portfolio.transfer.button")}
      <svg className={styles.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  return (
    <>
      {children(button)}
      <button
        type="button"
        className={styles.backdrop}
        data-open={open && sheet ? "true" : "false"}
        aria-label={t("portfolio.transfer.closeAria")}
        tabIndex={open && sheet ? 0 : -1}
        onClick={close}
      />
      <div
        ref={panelRef}
        id={panelId}
        className={styles.panel}
        data-open={open ? "true" : "false"}
        data-dragging={highlighted ? "true" : "false"}
        role={sheet && open ? "dialog" : undefined}
        aria-modal={sheet && open ? true : undefined}
        aria-hidden={open ? undefined : true}
        aria-label={sheet && open ? t("portfolio.transfer.dialog") : undefined}
      >
        <div className={styles.panelInner}>
          <div className={styles.panelBody}>
            <div className={styles.sheetHead}>
              <strong>{t("portfolio.transfer.title")}</strong>
              <button type="button" className="ob-btn-ghost" data-sheet-close onClick={close}>
                {t("common.close")}
              </button>
            </div>
            <PortfolioStatementImport
              portfolioId={portfolioId}
              portfolioName={portfolioName}
              holdingCount={holdingCount}
              incomingFile={incomingFile}
              onIncomingFileHandled={onIncomingFileHandled}
              onImported={finish}
              highlighted={highlighted}
            />
            <PortfolioExcelIO portfolioId={portfolioId} portfolioName={portfolioName} onDone={finish} />
          </div>
        </div>
      </div>
      {toast ? (
        <p className={styles.toast} role="status">
          {toast}
        </p>
      ) : null}
    </>
  );
}

export function usePortfolioFileDrag(
  onFile: (file: File) => void,
  onDragChange: (active: boolean) => void
): void {
  useEffect(() => {
    const enter = (event: DragEvent) => {
      if (!fileDrag(event)) return;
      event.preventDefault();
      onDragChange(true);
    };
    const over = (event: DragEvent) => {
      if (!fileDrag(event)) return;
      event.preventDefault();
    };
    const end = () => onDragChange(false);
    const drop = (event: DragEvent) => {
      if (!fileDrag(event)) return;
      const target = event.target as Element | null;
      onDragChange(false);
      if (target?.closest("[data-testid=sgi-drop]")) return;
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (file) onFile(file);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragend", end);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragend", end);
      window.removeEventListener("drop", drop);
    };
  }, [onFile, onDragChange]);
}
