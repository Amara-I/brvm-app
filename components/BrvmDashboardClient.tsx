"use client";

// ═══════════════════════════════════════════════════════════════════════════
// BRVM Dashboard — version connectée aux API, étape 8 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Port de `reference/BRVM_Dashboard.jsx` (fichier LECTURE SEULE, jamais
// modifié) : MÊME palette de couleurs, MÊME police, MÊMES textes français,
// MÊME structure d'onglets/sidebar, MÊME logique de calcul (les fonctions
// `calcMetrics`/`projectPrices` sont importées telles quelles depuis
// `lib/calc/*` — la même implémentation sert aussi les API routes et l'export
// Excel serveur, donc aucune duplication de logique métier front/back, cf.
// brief). Seul le SOURCING des données change : au lieu du tableau statique
// `COMPANIES_FULL`, les données arrivent via `getCompaniesFullDataset()`
// (SSR, cf. app/page.tsx) puis via `GET /api/companies/full` pour les
// rafraîchissements.
//
// Ajouts strictement additifs (non-négociables : ne rien casser, ne rien
// modifier visuellement) :
//   - Indicateur discret "Source des données" + "Dernière synchronisation"
//     par société (onglet Vue d'ensemble, sous le cours actuel).
//   - Bouton "Actualiser" : rafraîchit réellement les données (au lieu du
//     `setTimeout` factice d'origine) via `GET /api/companies/full`.
//   - Bouton "Exporter Excel" : déclenche `GET /api/export/excel` (génération
//     serveur, cf. lib/calc/export-workbook.ts) au lieu de `xlsx` côté client.
//   - Les quelques libellés qui embarquaient des MILLÉSIMES codés en dur
//     (ex: "2015 → 2026", ligne "Aujourd'hui" à 2026) utilisent désormais les
//     années réellement présentes en base (`years[0]`/`years[years.length-1]`)
//     — seuls les NOMBRES sont dynamiques, la formulation française reste
//     identique au caractère près.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { calcMetrics, type CalcMetricsResult } from "@/lib/calc/calc-metrics";
import { projectPrices, type PriceProjection } from "@/lib/calc/project-prices";
import type { CompaniesFullDataset, CompanyFullDataset } from "@/lib/api/companies-full-dataset";

// ── PALETTE ─────────────────────────────────────────────────────────────────
// Mise à jour "rebranding ouestBourse" (étape 11, 09/08/2026) : palette claire
// inspirée de la charte réelle ouestbourse.com, à la demande explicite de
// l'utilisateur (propriétaire confirmé de la marque) — cf.
// .cursor/rules/brvm-non-negotiable.mdc § "MISE À JOUR — Rebranding complet
// ouestBourse". Mêmes clés qu'avant (structure du composant intouchée),
// valeurs synchronisées avec `lib/theme/colors.ts`.
const C = {
  bg: "#FFFFFF",
  panel: "#F6F7F3",
  border: "#E2E5DD",
  gold: "#D9A441",
  goldDim: "#A67C2E",
  green: "#1E7A42",
  red: "#DC2626",
  blue: "#2563EB",
  silver: "#94A3B8",
  text: "#16241B",
  textDim: "#5B6B60",
  teal: "#0D9488",
  purple: "#9333EA",
};

// ── Libellés lisibles pour l'indicateur discret "source des données" ───────
const DATA_SOURCE_LABELS: Record<string, string> = {
  BRVM_OFFICIEL: "BRVM officiel",
  SIKAFINANCE: "Sikafinance",
  RICHBOURSE: "Richbourse",
  MANUEL: "Saisie manuelle",
};

function formatSyncTimestamp(iso: string | null): string {
  if (!iso) return "N/D";
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR")} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

// ── CUSTOM TOOLTIP (identique à reference/BRVM_Dashboard.jsx) ───────────────
interface ChartTipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name: string; value: number | string; color?: string }>;
}
const ChartTip = ({ active, payload, label }: ChartTipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px", fontSize: 12, boxShadow: "0 6px 20px rgba(20,30,25,0.12)" }}>
      <div style={{ color: C.gold, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color || C.text, marginBottom: 2 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString("fr-FR") : p.value}
        </div>
      ))}
    </div>
  );
};

export interface BrvmDashboardClientProps {
  initialData: CompaniesFullDataset;
}

export default function BrvmDashboardClient({ initialData }: BrvmDashboardClientProps) {
  const [dataset, setDataset] = useState<CompaniesFullDataset>(initialData);
  const companies = dataset.companies;
  const years = dataset.years;

  // Tickers pré-sélectionnés par défaut à l'identique de reference/BRVM_Dashboard.jsx
  // ("SNTS" / ["SNTS","CBIBF","SGBC"]) tant qu'ils existent dans le jeu de
  // données courant ; repli sur la première société si jamais absents (ex :
  // base non re-seedée avec l'échantillon d'origine).
  const DEFAULT_TICKER = companies.some((c) => c.ticker === "SNTS") ? "SNTS" : (companies[0]?.ticker ?? "");
  const DEFAULT_COMPARISON = ["SNTS", "CBIBF", "SGBC"].filter((t) => companies.some((c) => c.ticker === t));

  const [selectedTicker, setSelectedTicker] = useState(DEFAULT_TICKER);
  const [tab, setTab] = useState<"overview" | "chart" | "projection" | "comparison">("overview");
  const [sectorFilter, setSectorFilter] = useState("Tous");
  const [sortBy, setSortBy] = useState<"score" | "perf5" | "yield">("score");
  const [showProj, setShowProj] = useState(true);
  const [compSelected, setCompSelected] = useState<string[]>(
    DEFAULT_COMPARISON.length > 0 ? DEFAULT_COMPARISON : companies.slice(0, 3).map((c) => c.ticker)
  );
  const [lastUpdate, setLastUpdate] = useState(() => new Date(initialData.generatedAt).toLocaleDateString("fr-FR"));
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [projYears, setProjYears] = useState(5);

  // Si un rafraîchissement fait disparaître la société sélectionnée (ex:
  // radiation), on retombe sur la première disponible plutôt que de planter.
  useEffect(() => {
    if (companies.length > 0 && !companies.some((c) => c.ticker === selectedTicker)) {
      setSelectedTicker(companies[0].ticker);
    }
  }, [companies, selectedTicker]);

  const SECTORS = useMemo(() => ["Tous", ...Array.from(new Set(companies.map((c) => c.sector)))], [companies]);

  // Une seule passe de calcul par société — MÊME fonction que celle utilisée
  // par les API routes et l'export Excel serveur (cf. lib/calc/calc-metrics.ts).
  const metricsByTicker = useMemo(() => {
    const map = new Map<string, CalcMetricsResult>();
    for (const co of companies) {
      map.set(co.ticker, calcMetrics({ years, prices: co.prices, dividends: co.dividends, per: co.per }));
    }
    return map;
  }, [companies, years]);

  const company = companies.find((c) => c.ticker === selectedTicker);
  const metrics = company ? (metricsByTicker.get(company.ticker) ?? null) : null;
  const baseYear = years[years.length - 1] ?? new Date().getUTCFullYear();

  const projections: PriceProjection[] = useMemo(() => {
    if (!company) return [];
    const historicalPrices = years.map((y) => ({ year: y, price: company.prices[y] ?? 0 }));
    return projectPrices(historicalPrices, { futureYears: projYears, baseYear });
  }, [company, years, projYears, baseYear]);

  const filteredCompanies = useMemo(() => {
    return companies
      .filter((c) => sectorFilter === "Tous" || c.sector === sectorFilter)
      .sort((a, b) => {
        const ma = metricsByTicker.get(a.ticker)!;
        const mb = metricsByTicker.get(b.ticker)!;
        if (sortBy === "score") return mb.score - ma.score;
        if (sortBy === "perf5") return parseFloat(String(mb.perf5Percent)) - parseFloat(String(ma.perf5Percent));
        if (sortBy === "yield") return parseFloat(String(mb.dividendYieldPercent)) - parseFloat(String(ma.dividendYieldPercent));
        return 0;
      });
  }, [companies, sectorFilter, sortBy, metricsByTicker]);

  // Build chart data for selected company
  const chartData = useMemo(() => {
    if (!company) return [];
    return years
      .filter((y) => company.prices[y] > 0)
      .map((y) => ({ year: y, cours: company.prices[y], dividende: company.dividends[y] || 0, type: "historique" }));
  }, [company, years]);

  const projChartData = useMemo(
    () =>
      showProj
        ? projections.map((p) => ({ year: p.year, projected: p.projected, optimistic: p.optimistic, pessimistic: p.pessimistic, type: "projection" }))
        : [],
    [showProj, projections]
  );

  const allChartData = useMemo(() => [...chartData, ...projChartData], [chartData, projChartData]);

  // Comparison data (base 100 à la première année de cotation connue)
  const compData = useMemo(() => {
    return years.map((y) => {
      const obj: Record<string, number> = { year: y };
      for (const t of compSelected) {
        const co = companies.find((c) => c.ticker === t);
        if (co && co.prices[y] > 0) {
          const firstValid = years.find((fy) => co.prices[fy] > 0);
          obj[t] = firstValid ? Math.round((co.prices[y] / co.prices[firstValid]) * 100) : 0;
        }
      }
      return obj;
    });
  }, [years, compSelected, companies]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/companies/full", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setDataset(json.data as CompaniesFullDataset);
        setLastUpdate(new Date(json.data.generatedAt).toLocaleDateString("fr-FR"));
      }
    } catch {
      // Échec réseau/serveur : on conserve silencieusement les données déjà
      // affichées plutôt que de casser l'UI (cf. contrainte de robustesse).
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export/excel");
      if (!res.ok) throw new Error(`export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BRVM_Analyse_${lastUpdate.replace(/\//g, "-")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Cf. handleRefresh : on n'interrompt pas l'expérience utilisateur si
      // l'export échoue (ex: base de données temporairement indisponible).
    } finally {
      setExporting(false);
    }
  }, [exporting, lastUpdate]);

  const toggleComp = (t: string) => {
    setCompSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev.slice(-2), t]));
  };

  // ── ÉTAT VIDE (base non encore seedée/synchronisée) — cas nouveau qui
  // n'existait pas avec le tableau statique d'origine, géré sans perturber
  // le reste de la mise en page. ──────────────────────────────────────────
  if (companies.length === 0) {
    return (
      <div
        style={{
          background: C.bg,
          minHeight: "100vh",
          color: C.text,
          fontFamily: "'Trebuchet MS', Georgia, serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: C.gold, marginBottom: 8 }}>BRVM Dashboard</div>
          <div style={{ color: C.textDim, fontSize: "0.85rem" }}>Aucune donnée disponible pour le moment.</div>
        </div>
      </div>
    );
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Trebuchet MS', Georgia, serif" }}>
      {/* ── TOP BAR ── */}
      <div
        style={{
          background: C.panel,
          borderBottom: `1px solid ${C.border}`,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: "0.6rem", letterSpacing: "0.35em", color: C.gold, textTransform: "uppercase" }}>
            Bourse Régionale des Valeurs Mobilières
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>BRVM Dashboard — Analyse 10 ans</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: "0.72rem", color: C.textDim }}>
            Dernière MAJ : <span style={{ color: C.gold }}>{lastUpdate}</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            style={{
              background: refreshing ? C.border : C.gold,
              color: refreshing ? C.textDim : "#000",
              border: "none",
              borderRadius: 4,
              padding: "7px 16px",
              fontWeight: 700,
              fontSize: "0.78rem",
              cursor: refreshing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s",
            }}
          >
            {refreshing ? "⟳ Actualisation..." : "⟳ Actualiser les données"}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              background: "transparent",
              color: C.green,
              border: `1px solid ${C.green}`,
              borderRadius: 4,
              padding: "7px 16px",
              fontWeight: 700,
              fontSize: "0.78rem",
              cursor: exporting ? "not-allowed" : "pointer",
            }}
          >
            ↓ Exporter Excel
          </button>
        </div>
      </div>

      {/* ── MARKET KPIs ── */}
      <div style={{ display: "flex", gap: 10, padding: "12px 20px", flexWrap: "wrap", borderBottom: `1px solid ${C.border}` }}>
        {[
          { l: "Sociétés cotées", v: `${companies.length}`, c: C.blue },
          { l: "Capitalisation totale", v: `${companies.reduce((a, b) => a + b.mktcap, 0).toLocaleString()} Mds FCFA`, c: C.gold },
          {
            l: "Rend. moyen marché",
            v: `${(
              companies.map((c) => parseFloat(String(metricsByTicker.get(c.ticker)!.dividendYieldPercent))).reduce((a, b) => a + b, 0) /
              companies.length
            ).toFixed(2)}%`,
            c: C.green,
          },
          {
            l: "Perf. moy. 5 ans",
            v: `+${(
              companies
                .map((c) => parseFloat(String(metricsByTicker.get(c.ticker)!.perf5Percent)))
                .filter((v) => v > 0)
                .reduce((a, b) => a + b, 0) / companies.filter((c) => metricsByTicker.get(c.ticker)!.perf5Percent !== "N/D").length
            ).toFixed(1)}%`,
            c: C.teal,
          },
          { l: "Signaux ACHAT", v: `${companies.filter((c) => metricsByTicker.get(c.ticker)!.score >= 65).length}`, c: C.green },
          { l: "Horizon données", v: `${years[0] ?? "?"} → ${(years[years.length - 1] ?? 0) + 5}`, c: C.purple },
        ].map((k) => (
          <div key={k.l} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 14px", flex: "1 1 140px" }}>
            <div style={{ fontSize: "0.6rem", color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{k.l}</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 0, height: "calc(100vh - 160px)", minHeight: 600 }}>
        {/* ── LEFT SIDEBAR — COMPANY LIST ── */}
        <div style={{ width: 220, background: C.panel, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Filters */}
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              aria-label="Filtrer les sociétés par secteur"
              style={{
                width: "100%",
                background: C.bg,
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: "5px 8px",
                fontSize: "0.72rem",
                marginBottom: 6,
              }}
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "score" | "perf5" | "yield")}
              aria-label="Trier les sociétés"
              style={{
                width: "100%",
                background: C.bg,
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: "5px 8px",
                fontSize: "0.72rem",
              }}
            >
              <option value="score">Trier par Score</option>
              <option value="perf5">Trier par Perf. 5 ans</option>
              <option value="yield">Trier par Dividende</option>
            </select>
          </div>

          {/* Company list */}
          <div style={{ overflowY: "auto", flex: 1 }} role="list" aria-label="Liste des sociétés cotées">
            {filteredCompanies.map((co) => {
              const m = metricsByTicker.get(co.ticker)!;
              const isSelected = co.ticker === selectedTicker;
              const perf5Value = parseFloat(String(m.perf5Percent));
              return (
                <div
                  key={co.ticker}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${co.name} (${co.ticker}), score ${m.score} sur 100`}
                  onClick={() => setSelectedTicker(co.ticker)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTicker(co.ticker);
                    }
                  }}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: `1px solid ${C.border}`,
                    background: isSelected ? "rgba(30, 122, 66, 0.08)" : "transparent",
                    borderLeft: isSelected ? `3px solid ${co.color}` : "3px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "0.65rem", color: co.color, fontWeight: 700 }}>{co.ticker}</span>
                      <span style={{ fontSize: "0.65rem", color: C.textDim, marginLeft: 4 }} aria-hidden="true">
                        {co.countryFlag}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: m.signal.color,
                        background: `${m.signal.color}20`,
                        padding: "1px 5px",
                        borderRadius: 3,
                      }}
                    >
                      {m.score}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.68rem", color: C.silver, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {co.name}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                    <span style={{ fontSize: "0.6rem", color: perf5Value > 0 ? C.green : C.red }}>
                      {m.perf5Percent !== "N/D" ? `${perf5Value > 0 ? "+" : ""}${m.perf5Percent}%` : "N/D"}
                    </span>
                    <span style={{ fontSize: "0.6rem", color: C.textDim }}>•</span>
                    <span style={{ fontSize: "0.6rem", color: C.teal }}>{m.dividendYieldPercent}%div</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tab bar */}
          <div role="tablist" aria-label="Sections du dashboard" style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, background: C.panel }}>
            {[
              { id: "overview" as const, label: "📊 Vue d'ensemble" },
              { id: "chart" as const, label: "📈 Courbe historique" },
              { id: "projection" as const, label: "🔮 Projection future" },
              { id: "comparison" as const, label: "⚖️ Comparaison" },
            ].map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`tabpanel-${t.id}`}
                onClick={() => setTab(t.id)}
                style={{
                  background: tab === t.id ? C.bg : "transparent",
                  color: tab === t.id ? C.gold : C.textDim,
                  border: "none",
                  borderBottom: tab === t.id ? `2px solid ${C.gold}` : "2px solid transparent",
                  padding: "10px 16px",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  fontWeight: tab === t.id ? 700 : 400,
                  transition: "all 0.15s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16 }} role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {/* ── OVERVIEW TAB ── */}
            {tab === "overview" && company && metrics && (
              <div>
                {/* Company header */}
                <div
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                    display: "flex",
                    gap: 20,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div style={{ borderLeft: `4px solid ${company.color}`, paddingLeft: 12 }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700, color: C.text }}>{company.name}</div>
                    <div style={{ color: C.textDim, fontSize: "0.78rem" }}>
                      {company.countryFlag} {company.country} · {company.sector}
                    </div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: C.gold, marginTop: 4 }}>
                      {metrics.currentPrice.toLocaleString("fr-FR")} FCFA
                    </div>
                    {/* Indicateur discret "source des données" / "dernière synchronisation" — étape 8 */}
                    <div style={{ fontSize: "0.58rem", color: C.textDim, marginTop: 3 }}>
                      Source : {company.dataSource ? (DATA_SOURCE_LABELS[company.dataSource] ?? company.dataSource) : "N/D"} · Synchronisé le{" "}
                      {formatSyncTimestamp(company.lastSyncedAt)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: 1 }}>
                    {[
                      { l: "Score", v: `${metrics.score}/100`, c: metrics.signal.color },
                      { l: "Signal", v: metrics.signal.label, c: metrics.signal.color },
                      {
                        l: "Perf. 5 ans",
                        v: `${parseFloat(String(metrics.perf5Percent)) > 0 ? "+" : ""}${metrics.perf5Percent}%`,
                        c: parseFloat(String(metrics.perf5Percent)) > 0 ? C.green : C.red,
                      },
                      {
                        l: "Perf. 10 ans",
                        v: `${parseFloat(String(metrics.perf10Percent)) > 0 ? "+" : ""}${metrics.perf10Percent}%`,
                        c: parseFloat(String(metrics.perf10Percent)) > 0 ? C.green : C.red,
                      },
                      { l: "Rendement div.", v: `${metrics.dividendYieldPercent}%`, c: C.teal },
                      { l: "PER", v: company.per, c: C.blue },
                      { l: "Volatilité", v: `${metrics.volatilityPercent}%`, c: C.silver },
                      { l: "Risque", v: metrics.riskLevel, c: metrics.riskLevel === "Faible" ? C.green : metrics.riskLevel === "Moyen" ? C.gold : C.red },
                    ].map((k) => (
                      <div key={k.l} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 12px", minWidth: 90 }}>
                        <div style={{ fontSize: "0.58rem", color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>{k.l}</div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Historical data table */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: C.gold, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Historique 10 ans ({years[0]} → {years[years.length - 1]})
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.73rem" }}>
                      <thead>
                        <tr>
                          {["Année", "Cours (FCFA)", "Dividende", "Perf. annuelle", "Rend. Div.", "Variation"].map((h) => (
                            <th
                              key={h}
                              scope="col"
                              style={{
                                padding: "6px 10px",
                                textAlign: "right",
                                color: C.textDim,
                                borderBottom: `1px solid ${C.border}`,
                                fontWeight: 600,
                                fontSize: "0.65rem",
                                textTransform: "uppercase",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {years
                          .filter((y) => company.prices[y] > 0)
                          .map((y, i, arr) => {
                            const prev = i > 0 ? company.prices[arr[i - 1]] : null;
                            const perf = prev ? (((company.prices[y] - prev) / prev) * 100).toFixed(1) : null;
                            const rend = company.prices[y] > 0 && company.dividends[y] > 0 ? ((company.dividends[y] / company.prices[y]) * 100).toFixed(2) : null;
                            return (
                              <tr key={y} style={{ borderBottom: `1px solid ${C.border}20`, background: y % 2 === 0 ? C.panel : "transparent" }}>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: C.gold, fontWeight: 700 }}>{y}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: C.text, fontVariantNumeric: "tabular-nums" }}>
                                  {company.prices[y].toLocaleString("fr-FR")}
                                </td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: C.teal }}>
                                  {company.dividends[y] > 0 ? company.dividends[y].toLocaleString("fr-FR") : "—"}
                                </td>
                                <td
                                  style={{
                                    padding: "6px 10px",
                                    textAlign: "right",
                                    color: perf ? (parseFloat(perf) >= 0 ? C.green : C.red) : C.textDim,
                                    fontWeight: perf ? 700 : 400,
                                  }}
                                >
                                  {perf ? `${parseFloat(perf) >= 0 ? "+" : ""}${perf}%` : "—"}
                                </td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: C.teal }}>{rend ? `${rend}%` : "—"}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right" }}>
                                  {perf && (
                                    <div
                                      style={{
                                        display: "inline-block",
                                        height: 6,
                                        width: `${Math.min(80, Math.abs(parseFloat(perf)) * 3)}px`,
                                        background: parseFloat(perf) >= 0 ? `${C.green}30` : `${C.red}30`,
                                        border: `1px solid ${parseFloat(perf) >= 0 ? C.green : C.red}`,
                                        borderRadius: 2,
                                      }}
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mini chart */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: C.gold, marginBottom: 10 }}>Aperçu cours &amp; dividendes</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: C.textDim, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                      />
                      <Tooltip content={<ChartTip />} />
                      <defs>
                        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={company.color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={company.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="cours" name="Cours" stroke={company.color} fill="url(#cg)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── CHART TAB ── */}
            {tab === "chart" && company && (
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: C.gold, marginBottom: 12 }}>
                  Historique complet {company.name} ({company.ticker}) — {years[0]} à {years[years.length - 1]}
                </div>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: "0.65rem", color: C.textDim, marginBottom: 8 }}>Évolution du cours (FCFA)</div>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: C.textDim, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={65}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                      />
                      <Tooltip content={<ChartTip />} />
                      <defs>
                        <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={company.color} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={company.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="cours"
                        name="Cours FCFA"
                        stroke={company.color}
                        fill="url(#cg2)"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: company.color, strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: "0.65rem", color: C.textDim, marginBottom: 8 }}>Dividendes distribués par an (FCFA/action)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData.filter((d) => d.dividende > 0)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="dividende" name="Dividende" fill={C.teal} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: "0.65rem", color: C.textDim, marginBottom: 8 }}>Performance annuelle (%)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={years
                        .filter((y) => company.prices[y] > 0)
                        .slice(1)
                        .map((y, i) => {
                          const prevY = years.filter((yr) => company.prices[yr] > 0)[i];
                          const perf = ((company.prices[y] - company.prices[prevY]) / company.prices[prevY]) * 100;
                          return { year: y, performance: parseFloat(perf.toFixed(1)) };
                        })}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<ChartTip />} />
                      <ReferenceLine y={0} stroke={C.border} strokeWidth={2} />
                      <Bar dataKey="performance" name="Perf. %" radius={[3, 3, 0, 0]} fill={C.green} label={{ position: "top", fill: C.textDim, fontSize: 9 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── PROJECTION TAB ── */}
            {tab === "projection" && company && metrics && (
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: C.gold }}>
                    Projection {company.name} — Régression linéaire sur données historiques
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: "0.65rem", color: C.textDim }}>Horizon :</span>
                    {[3, 5, 7, 10].map((y) => (
                      <button
                        key={y}
                        onClick={() => setProjYears(y)}
                        aria-pressed={projYears === y}
                        style={{
                          background: projYears === y ? C.gold : "transparent",
                          color: projYears === y ? "#000" : C.textDim,
                          border: `1px solid ${projYears === y ? C.gold : C.border}`,
                          borderRadius: 3,
                          padding: "3px 10px",
                          cursor: "pointer",
                          fontSize: "0.68rem",
                        }}
                      >
                        {y} ans
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: "0.65rem", color: C.textDim, marginBottom: 8 }}>
                    Historique + Projection (scénarios optimiste / central / pessimiste)
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={allChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: C.textDim, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={65}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                      />
                      <Tooltip content={<ChartTip />} />
                      <Legend wrapperStyle={{ fontSize: "0.7rem", color: C.textDim }} />
                      <ReferenceLine x={baseYear} stroke={C.gold} strokeDasharray="4 4" label={{ value: "Aujourd'hui", fill: C.gold, fontSize: 10 }} />
                      <Line type="monotone" dataKey="cours" name="Historique" stroke={company.color} strokeWidth={2.5} dot={{ r: 3, fill: company.color }} connectNulls />
                      <Line type="monotone" dataKey="projected" name="Proj. centrale" stroke={C.silver} strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3, fill: C.silver }} connectNulls />
                      <Line type="monotone" dataKey="optimistic" name="Scénario optimiste" stroke={C.green} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
                      <Line type="monotone" dataKey="pessimistic" name="Scénario pessimiste" stroke={C.red} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Projection table */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: C.gold, marginBottom: 10 }}>Tableau de projection</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.73rem" }}>
                      <thead>
                        <tr>
                          {["Année", "Scénario central", "Optimiste (+15%)", "Pessimiste (-15%)", "Potentiel (%)", "Div. estimé"].map((h) => (
                            <th
                              key={h}
                              scope="col"
                              style={{ padding: "7px 10px", textAlign: "right", color: C.textDim, borderBottom: `1px solid ${C.border}`, fontSize: "0.65rem", textTransform: "uppercase" }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {projections.map((p) => {
                          const pot = (((p.projected - metrics.currentPrice) / metrics.currentPrice) * 100).toFixed(1);
                          const estDiv = metrics.currentDividend > 0 ? Math.round(metrics.currentDividend * (1 + 0.05 * (p.year - baseYear))) : "N/D";
                          return (
                            <tr key={p.year} style={{ borderBottom: `1px solid ${C.border}20` }}>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: C.gold, fontWeight: 700 }}>{p.year}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: C.silver, fontVariantNumeric: "tabular-nums" }}>
                                {p.projected.toLocaleString("fr-FR")}
                              </td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: C.green }}>{p.optimistic.toLocaleString("fr-FR")}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: C.red }}>{p.pessimistic.toLocaleString("fr-FR")}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: parseFloat(pot) >= 0 ? C.green : C.red, fontWeight: 700 }}>
                                {parseFloat(pot) >= 0 ? "+" : ""}
                                {pot}%
                              </td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: C.teal }}>{typeof estDiv === "number" ? estDiv.toLocaleString("fr-FR") : estDiv}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 10, fontSize: "0.62rem", color: C.textDim, fontStyle: "italic" }}>
                    ⚠️ Projections basées sur la régression linéaire des données historiques. Non garanties. Scénarios ±15% par rapport à la tendance centrale.
                  </div>
                </div>
              </div>
            )}

            {/* ── COMPARISON TAB ── */}
            {tab === "comparison" && (
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: C.gold, marginBottom: 8 }}>Sélectionner jusqu&apos;à 3 actions à comparer</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {companies.map((co) => {
                    const sel = compSelected.includes(co.ticker);
                    return (
                      <button
                        key={co.ticker}
                        onClick={() => toggleComp(co.ticker)}
                        aria-pressed={sel}
                        aria-label={`${sel ? "Retirer" : "Ajouter"} ${co.name} (${co.ticker}) de la comparaison`}
                        style={{
                          background: sel ? `${co.color}25` : "transparent",
                          color: sel ? co.color : C.textDim,
                          border: `1px solid ${sel ? co.color : C.border}`,
                          borderRadius: 4,
                          padding: "4px 10px",
                          cursor: "pointer",
                          fontSize: "0.68rem",
                          fontWeight: sel ? 700 : 400,
                          transition: "all 0.15s",
                        }}
                      >
                        <span aria-hidden="true">{co.countryFlag}</span> {co.ticker}
                      </button>
                    );
                  })}
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: "0.65rem", color: C.textDim, marginBottom: 8 }}>Performance relative (base 100 à l&apos;introduction)</div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={compData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip content={<ChartTip />} />
                      <Legend wrapperStyle={{ fontSize: "0.7rem", color: C.textDim }} />
                      <ReferenceLine y={100} stroke={C.border} strokeDasharray="4 4" />
                      {compSelected.map((t) => {
                        const co = companies.find((c) => c.ticker === t);
                        return co ? (
                          <Line key={t} type="monotone" dataKey={t} name={`${co.countryFlag} ${t}`} stroke={co.color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                        ) : null;
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Comparison metrics table */}
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: C.gold, marginBottom: 10 }}>Métriques comparées</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.73rem" }}>
                      <thead>
                        <tr>
                          {[
                            "Indicateur",
                            ...compSelected.map((t) => {
                              const co = companies.find((c) => c.ticker === t);
                              return co ? `${co.countryFlag} ${t}` : t;
                            }),
                          ].map((h) => (
                            <th
                              key={h}
                              scope="col"
                              style={{ padding: "7px 12px", textAlign: "right", color: C.textDim, borderBottom: `1px solid ${C.border}`, fontSize: "0.65rem", textTransform: "uppercase" }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            { l: "Cours actuel (FCFA)", fn: (m: CalcMetricsResult) => m.currentPrice.toLocaleString("fr-FR"), c: C.text as string | null },
                            { l: "Score (/100)", fn: (m: CalcMetricsResult) => m.score, c: null },
                            { l: "Signal", fn: (m: CalcMetricsResult) => m.signal.label, c: null },
                            {
                              l: "Perf. 5 ans (%)",
                              fn: (m: CalcMetricsResult) => `${parseFloat(String(m.perf5Percent)) > 0 ? "+" : ""}${m.perf5Percent}%`,
                              c: null,
                            },
                            {
                              l: "Perf. 10 ans (%)",
                              fn: (m: CalcMetricsResult) =>
                                m.perf10Percent !== "N/D" ? `${parseFloat(String(m.perf10Percent)) > 0 ? "+" : ""}${m.perf10Percent}%` : "N/D",
                              c: null,
                            },
                            { l: "Rendement div. (%)", fn: (m: CalcMetricsResult) => `${m.dividendYieldPercent}%`, c: C.teal as string | null },
                            { l: "PER", fn: (_m: CalcMetricsResult, co: CompanyFullDataset) => co.per, c: C.blue as string | null },
                            { l: "Volatilité (%)", fn: (m: CalcMetricsResult) => `${m.volatilityPercent}%`, c: null },
                            { l: "Risque", fn: (m: CalcMetricsResult) => m.riskLevel, c: null },
                            { l: "Cap. boursière", fn: (_m: CalcMetricsResult, co: CompanyFullDataset) => `${co.mktcap} Mds`, c: C.gold as string | null },
                          ] as Array<{ l: string; fn: (m: CalcMetricsResult, co: CompanyFullDataset) => string | number; c: string | null }>
                        ).map((row, ri) => (
                          <tr key={row.l} style={{ borderBottom: `1px solid ${C.border}20`, background: ri % 2 === 0 ? C.panel : "transparent" }}>
                            <td style={{ padding: "7px 12px", color: C.textDim, fontWeight: 600 }}>{row.l}</td>
                            {compSelected.map((t) => {
                              const co = companies.find((c) => c.ticker === t);
                              const m = co ? metricsByTicker.get(co.ticker) : null;
                              const v = co && m ? row.fn(m, co) : "—";
                              return (
                                <td key={t} style={{ padding: "7px 12px", textAlign: "right", color: row.c || C.text, fontWeight: row.l === "Signal" ? 700 : 400 }}>
                                  {v}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer — texte d'origine strictement inchangé (contrainte non-négociable) ;
          seul un lien discret vers /mentions-legales est ajouté à la suite,
          sans rien retirer, avec l'accord explicite de l'utilisateur (étape 9). */}
      <div style={{ textAlign: "center", padding: "10px 20px", fontSize: "0.6rem", color: C.textDim, borderTop: `1px solid ${C.border}`, background: C.panel }}>
        Sources : BRVM BOC · Sikafinance · RichBourse · Rapports annuels sociétés · Mai 2026 — ⚠️ Analyse informative uniquement. Les projections ne constituent pas un conseil en investissement.
        {" · "}
        <Link href="/mentions-legales" style={{ color: C.textDim, textDecoration: "underline" }}>
          Mentions légales
        </Link>
      </div>
    </div>
  );
}
