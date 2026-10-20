"use client";

import type { Ref } from "react";
import { ExpandChevronMark } from "@/components/ui/ExpandChevron";
import styles from "./MegaMenu.module.css";

export default function MegaMenuTrigger({
  label,
  open,
  panelId,
  triggerRef,
  onToggle,
  className,
  analyticsFeature,
  expandCaret = false,
}: {
  label: string;
  open: boolean;
  panelId: string;
  triggerRef: Ref<HTMLButtonElement>;
  onToggle: () => void;
  className: string;
  analyticsFeature: string;
  /** Chevron de dépliage (barre latérale) plutôt que le petit caret de menu. */
  expandCaret?: boolean;
}) {
  return (
    <button
      ref={triggerRef}
      type="button"
      className={className}
      aria-haspopup="true"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
      data-analytics-feature={analyticsFeature}
      data-analytics-action="mega_menu_toggle"
    >
      {label}
      {expandCaret ? (
        <ExpandChevronMark expanded={open} />
      ) : (
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">
          ▾
        </span>
      )}
    </button>
  );
}
