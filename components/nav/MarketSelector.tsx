"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isListingExchange, type ListingExchange } from "@/lib/markets/listing-scope";

import styles from "./MarketSelector.module.css";

const STORAGE_KEY = "ouestbourse-market";
export default function MarketSelector({ variant = "desktop" }: { variant?: "desktop" | "mobile" | "always" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [market, setMarket] = useState<ListingExchange>("BRVM");
  useEffect(() => {
    // La route explicite prime toujours sur la préférence (pas de redirection silencieuse).
    const routeMarket = pathname.includes("/marches/ngx") ? "NGX" :
      /\/(marche|actions|indices|screener|graphes|societes-cotees|calendrier-dividendes)(\/|$)/.test(pathname) ? "BRVM" : null;
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* stockage privé indisponible */ }
    const value = routeMarket ?? (isListingExchange(stored) ? stored : "BRVM");
    setMarket(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* navigation toujours possible */ }
  }, [pathname]);
  return <select aria-label="Marché actif" value={market} onChange={(event) => {
    const value = event.target.value as ListingExchange;
    setMarket(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* stockage optionnel */ }
    router.push(value === "NGX" ? "/marches/ngx" : "/marche");
  }} className={`${styles.selector} ${variant === "always" ? "" : styles[variant]}`}>
    <option value="BRVM">BRVM</option><option value="NGX">NGX</option>
  </select>;
}
