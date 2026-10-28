// Jeu de données fictif pour les tests et l'aperçu local de la fiche NGX.
// Les noms et chiffres sont inventés : ne jamais afficher en production.
import type { CompanyInput, SheetInput } from "./sheet-model";
import type { PricePoint } from "./price-stats";

function meta(shares: number | null, equityByYear: Record<number, number>, extra: Record<string, unknown> = {}) {
  const years: Record<string, unknown> = {};
  for (const [y, e] of Object.entries(equityByYear))
    years[y] = {
      equityBn: e,
      sourceUrl: "https://example.org/rapport-annuel.pdf",
    };
  return {
    board: "Premium Board",
    ngxFundamentals: {
      sharesOutstanding: shares
        ? {
            value: shares,
            asOf: "2025-12-31",
            sourceUrl: "https://example.org/rapport-annuel.pdf",
          }
        : null,
      years,
      ...extra,
    },
  };
}

function ratio(year: number, revenue: number | null, operatingIncome: number | null, netIncome: number | null) {
  return {
    year,
    revenue,
    operatingIncome,
    netIncome,
    isCanonical: true,
    source: "NGX_OFFICIEL",
  };
}

export function fixtureCompany(
  ticker: string,
  close: number | null,
  opts: {
    netIncome?: number[];
    revenue?: number[];
    equity?: number;
    shares?: number | null;
    dps?: number[];
    sector?: string;
    sectorSlug?: string;
  } = {},
): CompanyInput {
  const net = opts.netIncome ?? [];
  const rev = opts.revenue ?? [];
  const startYear = 2025 - Math.max(net.length, rev.length) + 1;
  const ratios =
    net.length || rev.length
      ? Array.from({ length: Math.max(net.length, rev.length) }, (_, i) =>
          ratio(startYear + i, rev[i] ?? null, rev[i] != null ? rev[i] * 0.3 : null, net[i] ?? null),
        )
      : [];
  const equity = opts.equity ?? null;
  return {
    ticker,
    name: ticker,
    sectorSlug: opts.sectorSlug ?? "consumer-goods",
    sectorName: opts.sector ?? "CONSUMER GOODS",
    board: "Premium Board",
    isin: null,
    description: null,
    listedSince: null,
    profileMeta: meta(opts.shares === undefined ? 1e9 : opts.shares, equity != null ? { 2025: equity } : {}),
    close,
    ratios,
    dividends: (opts.dps ?? []).map((amount, i, arr) => ({
      year: 2025 - (arr.length - 1 - i),
      amount,
      exDate: null,
      paymentDate: null,
      isCanonical: true,
      source: "NGX_OFFICIEL",
    })),
  };
}

export function fixtureSeries(days = 400, start = 100, drift = 0.0006, volume = 2_000_000): PricePoint[] {
  const out: PricePoint[] = [];
  const d = new Date("2025-09-01T00:00:00.000Z");
  let v = start;
  for (let i = 0; i < days; i += 1) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    v = v * (1 + drift + Math.sin(i / 7) * 0.006);
    out.push({
      time: d.toISOString().slice(0, 10),
      value: Math.round(v * 100) / 100,
      volume,
    });
  }
  return out;
}

export function fixtureSheetInput(): SheetInput {
  const net = [30, 34, 33, 41, 52, 60, 71, 88, 96, 118];
  const rev = [210, 230, 245, 270, 330, 390, 450, 560, 640, 780];
  const main = fixtureCompany("DEMOCEM", 420, {
    netIncome: net,
    revenue: rev,
    equity: 520,
    shares: 1.7e9,
    dps: [8, 9, 9, 12, 15, 18, 20, 24, 28, 32],
    sector: "INDUSTRIAL GOODS",
    sectorSlug: "industrial-goods",
  });
  const peers = [
    fixtureCompany("PEERA", 150, {
      netIncome: [10, 12, 15],
      revenue: [90, 100, 125],
      equity: 80,
      shares: 6e8,
      dps: [1, 1.5, 2],
      sector: "INDUSTRIAL GOODS",
      sectorSlug: "industrial-goods",
    }),
    fixtureCompany("PEERB", 60, {
      netIncome: [4, 5, 6],
      revenue: [50, 55, 60],
      equity: 40,
      shares: 8e8,
      dps: [0.5, 0.5, 0.6],
      sector: "INDUSTRIAL GOODS",
      sectorSlug: "industrial-goods",
    }),
    fixtureCompany("PEERC", 900, {
      netIncome: [60, 66, 80],
      revenue: [400, 460, 520],
      equity: 500,
      shares: 3e8,
      dps: [30, 33, 40],
      sector: "INDUSTRIAL GOODS",
      sectorSlug: "industrial-goods",
    }),
    fixtureCompany("PEERD", 22, {
      netIncome: [1, 1.2, 1.1],
      revenue: [30, 33, 36],
      equity: 14,
      shares: 5e8,
      dps: [0, 0.2, 0.2],
      sector: "INDUSTRIAL GOODS",
      sectorSlug: "industrial-goods",
    }),
  ];
  return {
    company: main,
    previousClose: 415,
    changePercent: 1.2,
    volume: 1_450_000,
    sessionDate: "2026-10-27",
    indicativeFcfa: 178,
    series: fixtureSeries(),
    events: [
      {
        title: "Assemblée générale annuelle 2026",
        eventType: "AGM",
        eventDate: "2026-12-03",
        endDate: null,
        comment: null,
        url: "https://example.org/agm",
        sourceName: "NGX",
      },
      {
        title: "Résultats du 3e trimestre 2026",
        eventType: "RESULTS",
        eventDate: "2026-10-24",
        endDate: null,
        comment: null,
        url: "https://example.org/q3",
        sourceName: "NGX",
      },
      {
        title: "Orientation de la direction — capacité",
        eventType: "GUIDANCE",
        eventDate: "2026-07-30",
        endDate: null,
        comment: "« La capacité installée passera à 52 Mt d'ici 2027. »",
        url: "https://example.org/h1",
        sourceName: "Présentation résultats S1 2026",
      },
    ],
    documents: [
      {
        title: "Rapport annuel 2025",
        filename: "2025-annual-report.pdf",
        url: "https://example.org/ar2025.pdf",
        docType: "ANNUAL_REPORT",
        periodLabel: "2025",
        publishedAt: "2026-03-28",
        sourceName: "NGX",
      },
      {
        title: "Rapport annuel 2024",
        filename: null,
        url: "https://example.org/ar2024.pdf",
        docType: "ANNUAL_REPORT",
        periodLabel: "2024",
        publishedAt: "2025-03-27",
        sourceName: "NGX",
      },
    ],
    universe: [main, ...peers],
    today: "2026-10-28",
  };
}
