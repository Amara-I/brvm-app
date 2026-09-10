import { buildBrvmIssuerResolver } from "./brvm-issuer-ticker";
import { brvmConnector } from "./connectors/brvm_connector";
import { richbourseConnector } from "./connectors/richbourse_connector";
import { sikafinanceConnector } from "./connectors/sikafinance_connector";
import {
  applySikaUpcomingDividendDates,
  persistDividendRows,
  persistRichbourseCalendarDividends,
} from "./persist";
import { syncCanonicalDividendDates } from "./dividend-date-sync";
import type { PrismaClient } from "@prisma/client";

export interface DividendsRefreshResult {
  brvm: { ok: boolean; rows: number; upserted: number; error?: string };
  richbourse: { ok: boolean; rows: number; upserted: number; error?: string };
  sikafinance: { ok: number; fail: number; upserted: number };
  sikaUpcoming: { rows: number; datesApplied: number };
  datesSynced: number;
  unknownIssuers: string[];
}

export async function runDividendsRefresh(
  db: PrismaClient,
  options?: { tickers?: string[]; skipSikafinance?: boolean }
): Promise<DividendsRefreshResult> {
  const only = options?.tickers?.map((t) => t.toUpperCase());
  const allCompanies = await db.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true, name: true },
    orderBy: { ticker: "asc" },
  });
  const sikaTargets = only?.length
    ? allCompanies.filter((c) => only.includes(c.ticker))
    : allCompanies;
  const companyIdByTicker = new Map(allCompanies.map((c) => [c.ticker, c.id]));
  const resolveTicker = buildBrvmIssuerResolver(allCompanies);

  const brvmResult = await brvmConnector.fetchDividendCalendar(resolveTicker);
  let brvmUpserted = 0;
  const unknownIssuers: string[] = [];

  if (brvmResult.ok) {
    const persist = await persistDividendRows(db, brvmResult.data, companyIdByTicker);
    brvmUpserted = persist.upserted;
    unknownIssuers.push(...persist.unknownTickers);
  }

  const calendarYear = new Date().getUTCFullYear();
  const richbourseResult = await richbourseConnector.fetchDividendCalendar(calendarYear);
  let richbourseUpserted = 0;
  if (richbourseResult.ok) {
    const rb = await persistRichbourseCalendarDividends(
      db,
      richbourseResult.data,
      companyIdByTicker
    );
    richbourseUpserted = rb.upserted;
    unknownIssuers.push(...rb.unknownTickers);
  }

  let sikaOk = 0;
  let sikaFail = 0;
  let sikaUpserted = 0;

  if (!options?.skipSikafinance) {
    for (const co of sikaTargets) {
      const sheet = await sikafinanceConnector.fetchCompanySheet(co.ticker);
      if (!sheet.ok) {
        sikaFail++;
        continue;
      }
      const divs = await persistDividendRows(db, sheet.data.dividends, companyIdByTicker);
      sikaOk++;
      sikaUpserted += divs.upserted;
    }
  }

  let sikaUpcomingRows = 0;
  let sikaUpcomingApplied = 0;
  const upcoming = await sikafinanceConnector.fetchUpcomingDividends();
  if (upcoming.ok) {
    sikaUpcomingRows = upcoming.data.length;
    sikaUpcomingApplied = await applySikaUpcomingDividendDates(
      db,
      upcoming.data,
      companyIdByTicker
    );
  }

  const datesSynced = await syncCanonicalDividendDates(db);

  return {
    brvm: {
      ok: brvmResult.ok,
      rows: brvmResult.ok ? brvmResult.data.length : 0,
      upserted: brvmUpserted,
      error: brvmResult.ok ? undefined : brvmResult.error,
    },
    richbourse: {
      ok: richbourseResult.ok,
      rows: richbourseResult.ok ? richbourseResult.data.length : 0,
      upserted: richbourseUpserted,
      error: richbourseResult.ok ? undefined : richbourseResult.error,
    },
    sikafinance: { ok: sikaOk, fail: sikaFail, upserted: sikaUpserted },
    sikaUpcoming: { rows: sikaUpcomingRows, datesApplied: sikaUpcomingApplied },
    datesSynced,
    unknownIssuers: [...new Set(unknownIssuers)],
  };
}
