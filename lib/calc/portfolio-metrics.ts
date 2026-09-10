// ═══════════════════════════════════════════════════════════════════════════
// Métriques de portefeuille — étape 7 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Logique PURE (aucun accès Prisma ici), façon Ouestbourse : valeur totale,
// plus/moins-value latente, répartition sectorielle (pour le donut chart),
// performance YTD.
//
// ⚠️ Simplification assumée pour la performance YTD : le schéma actuel
// (`PortfolioHolding`) ne conserve qu'une POSITION COURANTE (quantité + prix
// moyen d'achat pondéré), pas un historique complet des transactions. La
// performance YTD est donc calculée comme :
//
//     (valeur actuelle des positions détenues AUJOURD'HUI)
//   − (valeur théorique de CES MÊMES quantités au dernier cours de clôture
//      de l'année précédente)
//
// … ce qui SURESTIME légèrement la performance si des actions ont été
// achetées en cours d'année (elles n'ont "gagné" que depuis leur achat, pas
// depuis le 1er janvier). C'est un compromis standard tant qu'aucun grand
// livre de transactions n'existe — à raffiner si un historique d'ordres est
// ajouté au modèle plus tard.
// ═══════════════════════════════════════════════════════════════════════════

export interface HoldingMarketInput {
  /// Identifiant Prisma de la ligne (pour édition / suppression côté UI).
  id?: string;
  ticker: string;
  /// Raison sociale (affichage à côté du ticker).
  name?: string;
  sector: string;
  quantity: number;
  avgBuyPrice: number;
  /// Dernier cours de clôture canonique connu, ou `null` si aucune donnée
  /// n'est encore disponible pour cette société (→ "N/D" partout en aval).
  currentPrice: number | null;
  /// Date (UTC, jour de cotation) du `currentPrice`, ISO `YYYY-MM-DD`, ou `null`.
  currentPriceDate?: string | null;
  /// Dernier cours de clôture canonique de l'année précédente, ou `null`.
  yearStartPrice: number | null;
}

export interface HoldingMetrics {
  id?: string;
  ticker: string;
  name?: string;
  sector: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number | "N/D";
  /// Date du cours utilisé pour la valeur de marché (clôture canonique).
  currentPriceDate: string | "N/D";
  marketValue: number | "N/D";
  costBasis: number;
  gainLoss: number | "N/D";
  gainLossPercent: number | "N/D";
}

export interface SectorAllocation {
  sector: string;
  value: number;
  weightPercent: number;
}

export interface TickerAllocation {
  ticker: string;
  sector: string;
  value: number;
  weightPercent: number;
}

export interface PortfolioMetrics {
  holdings: HoldingMetrics[];
  totalMarketValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPercent: number | "N/D";
  /// Libellé honnête de la (des) date(s) de cours utilisée(s) pour la valeur
  /// de marché / plus-moins-value — ex. "Cours au 21/08/2026" ou une plage.
  marketPricesAsOfLabel: string | "N/D";
  /// Performance depuis le 1er janvier (cf. simplification documentée ci-dessus).
  ytdChangePercent: number | "N/D";
  /// Répartition de la valeur de marché par secteur, triée par poids
  /// décroissant — alimente directement le donut chart façon Ouestbourse.
  sectorBreakdown: SectorAllocation[];
  /// Répartition par titre (poids en % de la valeur de marché).
  tickerBreakdown: TickerAllocation[];
  /// Tickers pour lesquels aucun cours canonique n'est disponible (exclus du
  /// calcul de valeur, mais toujours listés dans `holdings` avec "N/D").
  unresolvedTickers: string[];
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatFrDay(isoDay: string): string {
  const [y, m, d] = isoDay.split("-");
  if (!y || !m || !d) return isoDay;
  return `${d}/${m}/${y}`;
}

/** Construit le libellé « Cours au … » à partir des dates ISO jour. */
export function buildMarketPricesAsOfLabel(isoDays: string[]): string | "N/D" {
  const unique = [...new Set(isoDays.filter(Boolean))].sort();
  if (unique.length === 0) return "N/D";
  if (unique.length === 1) return `Cours au ${formatFrDay(unique[0]!)}`;
  return `Cours du ${formatFrDay(unique[0]!)} au ${formatFrDay(unique[unique.length - 1]!)}`;
}

export function computePortfolioMetrics(holdings: HoldingMarketInput[]): PortfolioMetrics {
  const holdingMetrics: HoldingMetrics[] = [];
  const unresolvedTickers: string[] = [];
  const priceDays: string[] = [];

  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let totalYearStartValue = 0;
  let allYearStartPricesKnown = true;

  for (const h of holdings) {
    const costBasis = h.quantity * h.avgBuyPrice;
    totalCostBasis += costBasis;

    if (h.currentPrice === null) {
      unresolvedTickers.push(h.ticker);
      holdingMetrics.push({
        id: h.id,
        ticker: h.ticker,
        name: h.name,
        sector: h.sector,
        quantity: h.quantity,
        avgBuyPrice: h.avgBuyPrice,
        currentPrice: "N/D",
        currentPriceDate: "N/D",
        marketValue: "N/D",
        costBasis,
        gainLoss: "N/D",
        gainLossPercent: "N/D",
      });
      continue;
    }

    const marketValue = h.quantity * h.currentPrice;
    const gainLoss = marketValue - costBasis;
    const gainLossPercent = costBasis > 0 ? roundPercent((gainLoss / costBasis) * 100) : ("N/D" as const);
    totalMarketValue += marketValue;

    const priceDay = h.currentPriceDate?.trim() || null;
    if (priceDay) priceDays.push(priceDay);

    if (h.yearStartPrice !== null) {
      totalYearStartValue += h.quantity * h.yearStartPrice;
    } else {
      allYearStartPricesKnown = false;
    }

    holdingMetrics.push({
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      sector: h.sector,
      quantity: h.quantity,
      avgBuyPrice: h.avgBuyPrice,
      currentPrice: h.currentPrice,
      currentPriceDate: priceDay ?? "N/D",
      marketValue,
      costBasis,
      gainLoss,
      gainLossPercent,
    });
  }

  const totalGainLoss = totalMarketValue - totalCostBasis;
  const totalGainLossPercent = totalCostBasis > 0 ? roundPercent((totalGainLoss / totalCostBasis) * 100) : ("N/D" as const);

  const ytdChangePercent: number | "N/D" =
    allYearStartPricesKnown && totalYearStartValue > 0
      ? roundPercent(((totalMarketValue - totalYearStartValue) / totalYearStartValue) * 100)
      : "N/D";

  const sectorTotals = new Map<string, number>();
  for (const h of holdingMetrics) {
    if (typeof h.marketValue !== "number") continue;
    sectorTotals.set(h.sector, (sectorTotals.get(h.sector) ?? 0) + h.marketValue);
  }
  const sectorBreakdown: SectorAllocation[] = [...sectorTotals.entries()]
    .map(([sector, value]) => ({
      sector,
      value,
      weightPercent: totalMarketValue > 0 ? roundPercent((value / totalMarketValue) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const tickerBreakdown: TickerAllocation[] = holdingMetrics
    .filter((h): h is HoldingMetrics & { marketValue: number } => typeof h.marketValue === "number")
    .map((h) => ({
      ticker: h.ticker,
      sector: h.sector,
      value: h.marketValue,
      weightPercent: totalMarketValue > 0 ? roundPercent((h.marketValue / totalMarketValue) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    holdings: holdingMetrics,
    totalMarketValue,
    totalCostBasis,
    totalGainLoss,
    totalGainLossPercent,
    marketPricesAsOfLabel: buildMarketPricesAsOfLabel(priceDays),
    ytdChangePercent,
    sectorBreakdown,
    tickerBreakdown,
    unresolvedTickers,
  };
}
