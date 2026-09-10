/**
 * Simulation pédagogique d'investissement dans le temps
 * (capital initial + versements périodiques, intérêts composés).
 * Pas un conseil financier — hypothèses saisies par l'utilisateur.
 */

export type ContributionFrequency = "mensuel" | "trimestriel" | "annuel";

export interface InvestmentSimulationInput {
  /** Capital de départ (FCFA). */
  initialCapital: number;
  /** Versement périodique (FCFA). 0 = aucun. */
  contribution: number;
  frequency: ContributionFrequency;
  /** Durée en années (1–40). */
  years: number;
  /** Rendement annuel nominal attendu, en % (ex. 8 = 8 %). */
  annualReturnPercent: number;
  /** Frais / inflation effective annuelle en % à soustraire du rendement (0–20). */
  annualFeePercent?: number;
}

export interface InvestmentSimulationPoint {
  year: number;
  /** Fin d'année. */
  value: number;
  /** Cumul des versements (hors intérêts). */
  totalContributed: number;
  /** value − totalContributed. */
  gain: number;
}

export interface InvestmentSimulationResult {
  points: InvestmentSimulationPoint[];
  finalValue: number;
  totalContributed: number;
  totalGain: number;
  /** Gain / totalContributed * 100, ou "N/D" si rien versé. */
  gainPercent: number | "N/D";
  periodsPerYear: number;
  effectiveAnnualRate: number;
}

function contributionsPerYear(freq: ContributionFrequency): number {
  if (freq === "trimestriel") return 4;
  if (freq === "annuel") return 1;
  return 12;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Capitalisation périodique : à chaque période, intérêts puis versement
 * (versement en fin de période — convention simple et lisible).
 */
export function simulateInvestment(input: InvestmentSimulationInput): InvestmentSimulationResult {
  const years = clamp(Math.round(input.years), 1, 40);
  const initial = Math.max(0, input.initialCapital);
  const contribution = Math.max(0, input.contribution);
  const fee = clamp(input.annualFeePercent ?? 0, 0, 50);
  const gross = input.annualReturnPercent;
  const effectiveAnnualRate = (Number.isFinite(gross) ? gross : 0) - fee;
  const n = contributionsPerYear(input.frequency);
  const r = effectiveAnnualRate / 100 / n;
  const totalPeriods = years * n;

  let value = initial;
  let totalContributed = initial;
  const points: InvestmentSimulationPoint[] = [
    { year: 0, value: Math.round(value), totalContributed: Math.round(totalContributed), gain: 0 },
  ];

  for (let p = 1; p <= totalPeriods; p++) {
    value = value * (1 + r) + contribution;
    totalContributed += contribution;
    if (p % n === 0) {
      const year = p / n;
      const roundedValue = Math.round(value);
      const roundedContrib = Math.round(totalContributed);
      points.push({
        year,
        value: roundedValue,
        totalContributed: roundedContrib,
        gain: roundedValue - roundedContrib,
      });
    }
  }

  const final = points[points.length - 1]!;
  const gainPercent =
    final.totalContributed > 0
      ? Math.round((final.gain / final.totalContributed) * 1000) / 10
      : ("N/D" as const);

  return {
    points,
    finalValue: final.value,
    totalContributed: final.totalContributed,
    totalGain: final.gain,
    gainPercent,
    periodsPerYear: n,
    effectiveAnnualRate: Math.round(effectiveAnnualRate * 100) / 100,
  };
}

/** Scénarios central / optimiste / pessimiste autour du rendement saisi. */
export function simulateInvestmentScenarios(
  input: InvestmentSimulationInput,
  spreadPercent = 3
): {
  central: InvestmentSimulationResult;
  optimistic: InvestmentSimulationResult;
  pessimistic: InvestmentSimulationResult;
} {
  const spread = clamp(spreadPercent, 0, 20);
  return {
    central: simulateInvestment(input),
    optimistic: simulateInvestment({
      ...input,
      annualReturnPercent: input.annualReturnPercent + spread,
    }),
    pessimistic: simulateInvestment({
      ...input,
      annualReturnPercent: input.annualReturnPercent - spread,
    }),
  };
}
