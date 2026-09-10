// ═══════════════════════════════════════════════════════════════════════════
// Requêtes de veille par défaut — étape 10 + DESIGN premium (étape 16)
// ═══════════════════════════════════════════════════════════════════════════
// Modifiable librement sans toucher à l'orchestrateur (`run-research-agent.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import { ResearchCategory } from "@prisma/client";
import type { ResearchQuery } from "./types";

export const DEFAULT_RESEARCH_QUERIES: ResearchQuery[] = [
  // ── App Designer — sources catalogue (WCAG, fintech a11y, mobile Afrique) ─
  { query: "WCAG 2.2 AA finance dashboard accessibility patterns", category: ResearchCategory.UX },
  { query: "Nielsen Norman Group progressive disclosure financial products", category: ResearchCategory.UX },
  { query: "web.dev Core Web Vitals dashboard LCP INP CLS 2026", category: ResearchCategory.DESIGN },
  { query: "Mobbin fintech mobile investment app UI patterns Africa", category: ResearchCategory.DESIGN },
  { query: "explainable AI score card UX trust financial signal confidence risk", category: ResearchCategory.DESIGN },
  { query: "homepage hero stock market analysis platform CTA conversion UX", category: ResearchCategory.DESIGN },
  { query: "live market ticker accessibility color independent status labels", category: ResearchCategory.UX },

  // ── Design premium (étape 16) ──────────────────────────────────────────
  { query: "fintech dashboard UI design trends 2026 premium trading", category: ResearchCategory.DESIGN },
  { query: "best practices stock screener interface UX 2026", category: ResearchCategory.DESIGN },
  { query: "Bloomberg Terminal inspired web design patterns modern", category: ResearchCategory.DESIGN },
  { query: "TradingView chart UI microinteractions finance product design", category: ResearchCategory.DESIGN },
  { query: "dark mode light mode finance app design system accessibility", category: ResearchCategory.DESIGN },
  { query: "mobile first investment app Africa UX patterns 2026", category: ResearchCategory.DESIGN },
  { query: "TradingView lightweight charts best practices finance web app 2026", category: ResearchCategory.DESIGN },
  { query: "candlestick chart UX volume profile stock analysis interface", category: ResearchCategory.DESIGN },
  { query: "multi timeframe chart comparison overlay SMA indicators UI", category: ResearchCategory.FONCTIONNALITE },
  { query: "BRVM historical price chart features investors want", category: ResearchCategory.FONCTIONNALITE },

  // ── UX / contenu / features / concurrence (existant) ────────────────────
  { query: "multi exchange stock market selector UX dashboard Africa BRVM NGX JSE", category: ResearchCategory.DESIGN },
  { query: "market overview KPI strip indices market cap listed companies finance UI", category: ResearchCategory.DESIGN },
  { query: "equity watchlist position list detail panel master-detail trading terminal", category: ResearchCategory.UX },
  { query: "meilleures pratiques UX design application fintech mobile 2026", category: ResearchCategory.UX },
  { query: "accessibilité web mobile bonnes pratiques dashboard financier", category: ResearchCategory.UX },
  { query: "actualités BRVM Bourse Régionale des Valeurs Mobilières", category: ResearchCategory.CONTENU },
  { query: "nouvelles fonctionnalités site ouestbourse.com", category: ResearchCategory.CONCURRENCE },
  { query: "sikafinance.com nouvelles fonctionnalités marché boursier", category: ResearchCategory.CONCURRENCE },
  { query: "richbourse.com fonctionnalités analyse boursière", category: ResearchCategory.CONCURRENCE },
  { query: "fonctionnalités attendues application suivi portefeuille boursier Afrique", category: ResearchCategory.FONCTIONNALITE },
  { query: "multi horizon trading signal short medium long term UX explanation", category: ResearchCategory.FONCTIONNALITE },
  { query: "stock risk score VaR drawdown liquidity fundamental risk dashboard UI", category: ResearchCategory.FONCTIONNALITE },
];
