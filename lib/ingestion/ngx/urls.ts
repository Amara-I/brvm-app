import { formatNgxDocDate } from "./dates";

const DOCLIB = "https://doclib.ngxgroup.com";

/** Séance du jour uniquement. Non documenté : le connecteur vérifie la forme. */
export function ngxEquitiesJsonUrl(): string {
  return `${DOCLIB}/REST/api/statistics/equities/?market=&sector=&orderby=&pageSize=300&pageNo=0`;
}

export function ngxCoverPdfUrl(iso: string): string {
  return `${DOCLIB}/DownloadsContent/COVERPAGE%20FOR%20${formatNgxDocDate(iso)}.pdf`;
}

export function ngxOfficialListPdfUrl(iso: string): string {
  return `${DOCLIB}/DownloadsContent/Daily%20Official%20List%20-%20Equities%20for%20${formatNgxDocDate(iso)}.pdf`;
}

export function ngxDailySummaryPdfUrl(iso: string): string {
  return `${DOCLIB}/DownloadsContent/DAILY%20SUMMARY%20FOR%20${formatNgxDocDate(iso)}.pdf`;
}
