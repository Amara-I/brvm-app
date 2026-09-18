"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { C } from "@/lib/theme/colors";
import { SECTION_TITLE, PANEL_TEXT } from "@/lib/theme/typography";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import {
  simulateInvestmentScenarios,
  type ContributionFrequency,
} from "@/lib/calc/simulate-investment";
import {
  getPortfolioTypeDef,
  type PortfolioTypeId,
} from "@/lib/portfolio-types";
import { usePortfolioType } from "@/lib/portfolio-types/use-portfolio-type";
import PortfolioTypeSelector from "@/components/portfolio-types/PortfolioTypeSelector";
import Link from "next/link";
import styles from "./InvestmentSimulator.module.css";

function fmtFcfa(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const FREQ_OPTIONS: Array<{ value: ContributionFrequency; label: string }> = [
  { value: "mensuel", label: "Mensuel" },
  { value: "trimestriel", label: "Trimestriel" },
  { value: "annuel", label: "Annuel" },
];

export default function InvestmentSimulator({
  preferredPortfolioType = null,
}: {
  preferredPortfolioType?: PortfolioTypeId | null;
}) {
  const { type, setType, profileDefault, isOverride, resetToProfile } =
    usePortfolioType(preferredPortfolioType);
  const def = getPortfolioTypeDef(type);
  const [initial, setInitial] = usePersistedState("ouestbourse:sim:initial", "1000000");
  const [contribution, setContribution] = usePersistedState("ouestbourse:sim:contrib", "50000");
  const [frequency, setFrequency] = usePersistedState<ContributionFrequency>(
    "ouestbourse:sim:freq",
    "mensuel"
  );
  const [years, setYears] = usePersistedState("ouestbourse:sim:years", "10");
  const [rate, setRate] = usePersistedState("ouestbourse:sim:rate", "8");
  const [fees, setFees] = usePersistedState("ouestbourse:sim:fees", "0.5");
  const [spread, setSpread] = useState("3");

  const scenarios = useMemo(() => {
    const input = {
      initialCapital: parseAmount(initial),
      contribution: parseAmount(contribution),
      frequency,
      years: parseAmount(years) || 1,
      annualReturnPercent: parseAmount(rate),
      annualFeePercent: parseAmount(fees),
    };
    return simulateInvestmentScenarios(input, parseAmount(spread) || 3);
  }, [initial, contribution, frequency, years, rate, fees, spread]);

  const chartData = useMemo(() => {
    const { central, optimistic, pessimistic } = scenarios;
    return central.points.map((p, i) => ({
      year: p.year,
      central: p.value,
      optimistic: optimistic.points[i]?.value ?? p.value,
      pessimistic: pessimistic.points[i]?.value ?? p.value,
      versé: p.totalContributed,
    }));
  }, [scenarios]);

  const central = scenarios.central;

  return (
    <div className={styles.wrap} data-align-left>
      <PortfolioTypeSelector
        value={type}
        onChange={setType}
        profileDefault={profileDefault}
        isOverride={isOverride}
        onResetToProfile={resetToProfile}
        idPrefix="sim"
      />
      <aside className={styles.perspective} aria-live="polite">
        <p className={styles.perspectiveKicker}>
          {def.label} · {def.horizon} · risque {def.risk}
        </p>
        <p className={styles.perspectiveLead}>{def.simulationLead}</p>
        <ul className={styles.perspectiveList}>
          {def.simulationHints.map((h) => (
            <li key={h.slice(0, 36)}>{h}</li>
          ))}
        </ul>
        <div className={styles.alloc}>
          {def.allocation.map((row) => (
            <div key={row.component} className={styles.allocRow}>
              <span>{row.component}</span>
              <strong>{row.allocation}</strong>
            </div>
          ))}
        </div>
        <p className={styles.allocNote}>{def.allocationNote}</p>
        <p className={styles.suggestNote}>{def.simulationSuggest.note}</p>
        <button
          type="button"
          className={styles.applyBtn}
          onClick={() => {
            setYears(def.simulationSuggest.years);
            setFees(def.simulationSuggest.fees);
            setSpread(def.simulationSuggest.spread);
          }}
        >
          Appliquer les paramètres pédagogiques (durée, frais, écart)
        </button>
        <p className={styles.perspectiveFoot}>
          Les rendements saisis restent les vôtres — aucun taux n’est inventé.{" "}
          <Link href={def.educationHref}>Guide {def.label}</Link>
        </p>
      </aside>
      <div className={styles.grid}>
        <form
          className={styles.form}
          onSubmit={(e) => e.preventDefault()}
          aria-label="Paramètres de simulation"
        >
          <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 14 }}>Paramètres</h2>

          <label className={styles.label}>
            Capital initial (FCFA)
            <input
              className={styles.input}
              inputMode="decimal"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
            />
          </label>

          <label className={styles.label}>
            Versement périodique (FCFA)
            <input
              className={styles.input}
              inputMode="decimal"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
            />
          </label>

          <label className={styles.label}>
            Fréquence des versements
            <select
              className={styles.input}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ContributionFrequency)}
            >
              {FREQ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Durée (années)
            <input
              className={styles.input}
              type="number"
              min={1}
              max={40}
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
          </label>

          <label className={styles.label}>
            Rendement annuel attendu (%)
            <input
              className={styles.input}
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>

          <label className={styles.label}>
            Frais annuels (%)
            <input
              className={styles.input}
              inputMode="decimal"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
            />
          </label>

          <label className={styles.label}>
            Écart scénarios ± (%)
            <input
              className={styles.input}
              inputMode="decimal"
              value={spread}
              onChange={(e) => setSpread(e.target.value)}
            />
          </label>

          <p className={styles.hint} style={PANEL_TEXT}>
            Rendement effectif utilisé :{" "}
            <strong style={{ color: C.text }}>{central.effectiveAnnualRate} %</strong> / an
            (après frais). Hypothèse pédagogique — pas un conseil d&apos;investissement.
          </p>
        </form>

        <div className={styles.results}>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 14 }}>Résultats</h2>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>Capital final (central)</span>
              <span className={styles.kpiValue}>{fmtFcfa(central.finalValue)}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>Total versé</span>
              <span className={styles.kpiValue}>{fmtFcfa(central.totalContributed)}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>Gain estimé</span>
              <span
                className={styles.kpiValue}
                style={{ color: central.totalGain >= 0 ? C.green : C.red }}
              >
                {central.totalGain >= 0 ? "+" : ""}
                {fmtFcfa(central.totalGain)}
                {central.gainPercent !== "N/D" ? ` (${central.gainPercent} %)` : ""}
              </span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>Scénario optimiste</span>
              <span className={styles.kpiValue} style={{ color: C.green }}>
                {fmtFcfa(scenarios.optimistic.finalValue)}
              </span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>Scénario pessimiste</span>
              <span className={styles.kpiValue} style={{ color: C.red }}>
                {fmtFcfa(scenarios.pessimistic.finalValue)}
              </span>
            </div>
          </div>

          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: C.textDim, fontSize: 11 }}
                  label={{ value: "Année", position: "insideBottom", offset: -2, fill: C.textDim }}
                />
                <YAxis
                  tickFormatter={(v) =>
                    Math.abs(Number(v)) >= 1_000_000
                      ? `${(Number(v) / 1_000_000).toFixed(1)}M`
                      : `${Math.round(Number(v) / 1000)}k`
                  }
                  tick={{ fill: C.textDim, fontSize: 11 }}
                  width={52}
                />
                <Tooltip
                  contentStyle={{
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    fontSize: "0.78rem",
                  }}
                  formatter={(value, name) => [
                    fmtFcfa(Number(value)),
                    name === "central"
                      ? "Central"
                      : name === "optimistic"
                        ? "Optimiste"
                        : name === "pessimistic"
                          ? "Pessimiste"
                          : "Versé",
                  ]}
                  labelFormatter={(y) => `Année ${y}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: "0.65rem", paddingTop: 4 }}
                  iconSize={8}
                  formatter={(value) =>
                    value === "central"
                      ? "Central"
                      : value === "optimistic"
                        ? "Optimiste"
                        : value === "pessimistic"
                          ? "Pessimiste"
                          : "Total versé"
                  }
                />
                <Area
                  type="monotone"
                  dataKey="optimistic"
                  stroke={C.green}
                  fill={C.green}
                  fillOpacity={0.08}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                <Area
                  type="monotone"
                  dataKey="central"
                  stroke={C.gold}
                  fill={C.gold}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="pessimistic"
                  stroke={C.red}
                  fill={C.red}
                  fillOpacity={0.06}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                <Area
                  type="monotone"
                  dataKey="versé"
                  stroke={C.blue}
                  fill="transparent"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.chartLegendBox}>
            <h3 className={styles.chartLegendTitle}>Légende des courbes</h3>
            <p className={styles.chartLegendLine}>
              <span className={styles.legendSwatch} style={{ background: C.gold }} aria-hidden />
              <span>
                <strong>Central :</strong> évolution du capital avec le rendement annuel saisi
                ({parseAmount(rate)} % avant frais, soit {central.effectiveAnnualRate} % effectif après frais).
              </span>
            </p>
            <p className={styles.chartLegendLine}>
              <span className={styles.legendSwatch} style={{ background: C.green }} aria-hidden />
              <span>
                <strong>Optimiste :</strong> même simulation avec un rendement plus élevé
                (+{parseAmount(spread) || 3} points de pourcentage par rapport au scénario central).
              </span>
            </p>
            <p className={styles.chartLegendLine}>
              <span className={styles.legendSwatch} style={{ background: C.red }} aria-hidden />
              <span>
                <strong>Pessimiste :</strong> même simulation avec un rendement plus faible
                (−{parseAmount(spread) || 3} points de pourcentage par rapport au scénario central).
              </span>
            </p>
            <p className={styles.chartLegendLine}>
              <span className={styles.legendSwatch} style={{ background: C.blue }} aria-hidden />
              <span>
                <strong>Total versé :</strong> somme du capital initial et de tous les versements périodiques,
                sans aucun rendement (référence de ce que vous avez réellement mis de côté).
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
