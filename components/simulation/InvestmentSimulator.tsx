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
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizedTypeDef } from "@/lib/i18n/portfolio-type-copy";
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

function fmtMoney(n: number, format: ReturnType<typeof useI18n>["format"]): string {
  return format.fcfa(n);
}

function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function percentDigits(n: number): number {
  const frac = String(Math.abs(n)).split(".")[1];
  return frac ? Math.min(frac.length, 2) : 0;
}

const FREQ_VALUES: ContributionFrequency[] = ["mensuel", "trimestriel", "annuel"];

export default function InvestmentSimulator({
  preferredPortfolioType = null,
}: {
  preferredPortfolioType?: PortfolioTypeId | null;
}) {
  const { t, format, locale } = useI18n();
  const { type, setType, profileDefault, isOverride, resetToProfile } =
    usePortfolioType(preferredPortfolioType);
  const def = localizedTypeDef(getPortfolioTypeDef(type), locale);
  const freqLabel = (value: ContributionFrequency) =>
    value === "trimestriel"
      ? t("tools.simulation.quarterly")
      : value === "annuel"
        ? t("tools.simulation.yearly")
        : t("tools.simulation.monthly");
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
      contributed: p.totalContributed,
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
          {t("portfolio.types.kicker", { label: def.label, horizon: def.horizon, risk: def.risk })}
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
          {t("tools.simulation.apply")}
        </button>
        <p className={styles.perspectiveFoot}>
          {t("tools.simulation.ratesNote")}{" "}
          <Link href={def.educationHref}>{t("portfolio.types.guide", { label: def.label })}</Link>
        </p>
      </aside>
      <div className={styles.grid}>
        <form
          className={styles.form}
          onSubmit={(e) => e.preventDefault()}
          aria-label={t("tools.simulation.formAria")}
        >
          <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 14 }}>{t("tools.simulation.parameters")}</h2>

          <label className={styles.label}>
            {t("tools.simulation.initial")}
            <input
              className={styles.input}
              inputMode="decimal"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
            />
          </label>

          <label className={styles.label}>
            {t("tools.simulation.contribution")}
            <input
              className={styles.input}
              inputMode="decimal"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
            />
          </label>

          <label className={styles.label}>
            {t("tools.simulation.frequency")}
            <select
              className={styles.input}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ContributionFrequency)}
            >
              {FREQ_VALUES.map((value) => (
                <option key={value} value={value}>
                  {freqLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            {t("tools.simulation.years")}
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
            {t("tools.simulation.rate")}
            <input
              className={styles.input}
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>

          <label className={styles.label}>
            {t("tools.simulation.fees")}
            <input
              className={styles.input}
              inputMode="decimal"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
            />
          </label>

          <label className={styles.label}>
            {t("tools.simulation.spread")}
            <input
              className={styles.input}
              inputMode="decimal"
              value={spread}
              onChange={(e) => setSpread(e.target.value)}
            />
          </label>

          <p className={styles.hint} style={PANEL_TEXT}>
            {t("tools.simulation.effectiveBefore")}{" "}
            <strong style={{ color: C.text }}>{format.percent(central.effectiveAnnualRate, 2)}</strong>{" "}
            {t("tools.simulation.effectiveAfter")}
          </p>
        </form>

        <div className={styles.results}>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 14 }}>{t("tools.simulation.results")}</h2>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>{t("tools.simulation.final")}</span>
              <span className={styles.kpiValue}>{fmtMoney(central.finalValue, format)}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>{t("tools.simulation.contributed")}</span>
              <span className={styles.kpiValue}>{fmtMoney(central.totalContributed, format)}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>{t("tools.simulation.gain")}</span>
              <span
                className={styles.kpiValue}
                style={{ color: central.totalGain >= 0 ? C.green : C.red }}
              >
                {central.totalGain >= 0 ? "+" : ""}
                {fmtMoney(central.totalGain, format)}
                {central.gainPercent !== "N/D"
                  ? ` (${format.percent(central.gainPercent, percentDigits(central.gainPercent))})`
                  : ""}
              </span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>{t("tools.simulation.optimistic")}</span>
              <span className={styles.kpiValue} style={{ color: C.green }}>
                {fmtMoney(scenarios.optimistic.finalValue, format)}
              </span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>{t("tools.simulation.pessimistic")}</span>
              <span className={styles.kpiValue} style={{ color: C.red }}>
                {fmtMoney(scenarios.pessimistic.finalValue, format)}
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
                  label={{ value: t("tools.simulation.yearAxis"), position: "insideBottom", offset: -2, fill: C.textDim }}
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
                    fmtMoney(Number(value), format),
                    name === "central"
                      ? t("tools.simulation.central")
                      : name === "optimistic"
                        ? t("tools.simulation.optimisticShort")
                        : name === "pessimistic"
                          ? t("tools.simulation.pessimisticShort")
                          : t("tools.simulation.contributedShort"),
                  ]}
                  labelFormatter={(y) => t("tools.simulation.yearLabel", { year: String(y) })}
                />
                <Legend
                  wrapperStyle={{ fontSize: "0.65rem", paddingTop: 4 }}
                  iconSize={8}
                  formatter={(value) =>
                    value === "central"
                      ? t("tools.simulation.central")
                      : value === "optimistic"
                        ? t("tools.simulation.optimisticShort")
                        : value === "pessimistic"
                          ? t("tools.simulation.pessimisticShort")
                          : t("tools.simulation.contributedLegend")
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
                  dataKey="contributed"
                  stroke={C.blue}
                  fill="transparent"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.chartLegendBox}>
            <h3 className={styles.chartLegendTitle}>{t("tools.simulation.legendTitle")}</h3>
            <p className={styles.chartLegendLine}>
              <span className={styles.legendSwatch} style={{ background: C.gold }} aria-hidden />
              <span>
                {t("tools.simulation.centralLegend", {
                  rate: format.number(parseAmount(rate)),
                  effective: format.number(central.effectiveAnnualRate),
                })}
              </span>
            </p>
            <p className={styles.chartLegendLine}>
              <span className={styles.legendSwatch} style={{ background: C.green }} aria-hidden />
              <span>
                {t("tools.simulation.optimisticLegend", {
                  spread: format.number(parseAmount(spread) || 3),
                })}
              </span>
            </p>
            <p className={styles.chartLegendLine}>
              <span className={styles.legendSwatch} style={{ background: C.red }} aria-hidden />
              <span>
                {t("tools.simulation.pessimisticLegend", {
                  spread: format.number(parseAmount(spread) || 3),
                })}
              </span>
            </p>
            <p className={styles.chartLegendLine}>
              <span className={styles.legendSwatch} style={{ background: C.blue }} aria-hidden />
              <span>{t("tools.simulation.contributedLegendText")}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
