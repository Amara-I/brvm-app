"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./NgxMarket.module.css";

export default function NgxRefreshControl() {
  const router = useRouter();
  const started = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("Actualisation automatique au démarrage");

  const refresh = useCallback(async (automatic = false) => {
    if (refreshing) return;
    setRefreshing(true);
    setMessage(automatic ? "Mise à jour des cours NGX…" : "Actualisation des cours NGX…");
    try {
      const response = await fetch("/api/market/refresh-ngx", { method: "POST", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "refresh failed");
      setMessage(payload.data?.skipped ? "Données NGX déjà actualisées" : "Cours NGX actualisés");
      router.refresh();
    } catch {
      setMessage("Actualisation indisponible — données précédentes conservées");
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void refresh(true);
  }, [refresh]);

  return (
    <div className={styles.refreshBar}>
      <span className={styles.refreshStatus} role="status" aria-live="polite">{message}</span>
      <button type="button" className={styles.refreshButton} onClick={() => void refresh()} disabled={refreshing} aria-busy={refreshing}>
        {refreshing ? "⟳ Actualisation…" : "⟳ Actualiser NGX"}
      </button>
    </div>
  );
}
