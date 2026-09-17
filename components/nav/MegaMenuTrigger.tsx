"use client";

import type { Ref } from "react";
import styles from "./MegaMenu.module.css";

export default function MegaMenuTrigger({
  label,
  open,
  panelId,
  triggerRef,
  onToggle,
  className,
  analyticsFeature,
}: {
  label: string;
  open: boolean;
  panelId: string;
  triggerRef: Ref<HTMLButtonElement>;
  onToggle: () => void;
  className: string;
  analyticsFeature: string;
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
      <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">
        ▾
      </span>
    </button>
  );
}
