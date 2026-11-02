import * as XLSX from "xlsx";

export interface MarketExportRow {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  prices: Record<number, number>;
  dividends: Record<number, number>;
  source: string | null;
  priceAsOf: string | null;
  ingestedAt: string | null;
}

/** Ne mélange jamais NGN et XOF et ne transforme pas une absence en zéro. */
export function appendNgxExport(buffer: Buffer, rows: MarketExportRow[], years: number[]): Buffer {
  const book = XLSX.read(buffer, { type: "buffer" }); // uniquement notre classeur généré, jamais un fichier utilisateur
  const headers = ["Ticker", "Société", "Marché", "Devise", "Pays", "Secteur", "Source cours", "Séance", "Collecté le",
    ...years.flatMap((y) => [`Cours ${y} (NGN)`, `Div. ${y} (NGN)`])];
  const values = rows.map((r) => [r.ticker, r.name, "NGX", "NGN", r.country, r.sector,
    r.source ?? "N/D", r.priceAsOf ?? "N/D", r.ingestedAt ?? "N/D",
    ...years.flatMap((y) => [r.prices[y] ?? "N/D", r.dividends[y] ?? "N/D"])]);
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, ...values]), "Données NGX");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
