"use client";

// Sondage léger des derniers cours pendant que l'application est ouverte.
//   - en séance : toutes les 60 s ; après la clôture : 5 min ; sinon 30 min ;
//     week-end : aucun sondage (lib/quotes/market-hours.ts) ;
//   - onglet masqué : rien ; retour sur l'onglet / la fenêtre : relecture si due ;
//   - notification reçue ou ouverte : relecture immédiate (requestQuoteRefresh).
// La route /api/quotes lit un cache serveur invalidé à chaque écriture de cours :
// un sondage ne déclenche pas de requête base de données.

import { useCallback, useEffect, useRef, useState } from "react";
import { focusRefreshGapMs, OFF_HOURS_POLL_MS, quotePollDelayMs } from "@/lib/quotes/market-hours";
import { hasPendingQuoteRefresh, QUOTE_REFRESH_EVENT, refreshConcerns, type QuoteRefreshDetail } from "@/lib/quotes/quote-events";
import { quoteChanged, type LatestQuote, type QuoteMarket } from "@/lib/quotes/types";

/** Au-delà, on demande la place entière (URL partagée, mieux mise en cache par le CDN). */
const MAX_TICKERS_IN_URL = 40;

export function liveQuotesUrl(market: QuoteMarket, tickers: readonly string[], bust?: number): string {
  const params = new URLSearchParams({ market });
  const list = [...new Set(tickers.map((t) => t.toUpperCase()))].sort();
  if (list.length > 0 && list.length <= MAX_TICKERS_IN_URL) params.set("tickers", list.join(","));
  if (bust) params.set("t", String(bust));
  return `/api/quotes?${params.toString()}`;
}

export interface UseLiveQuotesOptions {
  market: QuoteMarket;
  /** Tickers suivis ; vide = toute la place. */
  tickers?: readonly string[];
  /** Appelé avec les seuls cours nouveaux ou modifiés depuis la lecture précédente. */
  onChange?: (changed: LatestQuote[]) => void;
  enabled?: boolean;
}

export function useLiveQuotes({ market, tickers = [], onChange, enabled = true }: UseLiveQuotesOptions) {
  const [quotes, setQuotes] = useState<Record<string, LatestQuote>>({});
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const knownRef = useRef<Record<string, LatestQuote>>({});
  const lastRef = useRef(0);
  const inFlightRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const tickerKey = [...new Set(tickers.map((t) => t.toUpperCase()))].sort().join(",");

  const fetchNow = useCallback(
    async (bust = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      lastRef.current = Date.now();
      try {
        const list = tickerKey ? tickerKey.split(",") : [];
        const res = await fetch(liveQuotesUrl(market, list, bust ? Date.now() : undefined), {
          cache: bust ? "no-store" : "default",
        });
        const json = await res.json();
        if (!json?.ok || !Array.isArray(json.data?.quotes)) return;
        const incoming = json.data.quotes as LatestQuote[];
        const changed = incoming.filter((q) => quoteChanged(knownRef.current[q.ticker], q));
        if (changed.length === 0) return;
        const next = { ...knownRef.current };
        for (const q of changed) next[q.ticker] = q;
        knownRef.current = next;
        setQuotes(next);
        onChangeRef.current?.(changed);
      } catch {
        // best-effort : le prochain cycle relira
      } finally {
        inFlightRef.current = false;
        setLastFetchedAt(Date.now());
      }
    },
    [market, tickerKey]
  );

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const delay = quotePollDelayMs(market);
      // Week-end : pas de sondage, simple re-vérification de l'horaire.
      timer = window.setTimeout(tick, delay ?? OFF_HOURS_POLL_MS);
    };
    const tick = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible" && quotePollDelayMs(market) != null) {
        void fetchNow();
      }
      schedule();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRef.current >= focusRefreshGapMs(market)) void fetchNow();
    };
    const onRefreshRequest = (event: Event) => {
      const detail = (event as CustomEvent<QuoteRefreshDetail>).detail;
      if (!refreshConcerns(detail, tickerKey ? tickerKey.split(",") : [])) return;
      void fetchNow(true);
    };

    // Lecture de contrôle à l'ouverture (cache serveur : pas de requête base).
    void fetchNow(hasPendingQuoteRefresh());
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener(QUOTE_REFRESH_EVENT, onRefreshRequest);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener(QUOTE_REFRESH_EVENT, onRefreshRequest);
    };
  }, [enabled, market, tickerKey, fetchNow]);

  return { quotes, lastFetchedAt, refresh: () => fetchNow(true) };
}
