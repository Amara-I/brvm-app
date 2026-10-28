// Communiqués NGX (liste officielle XFinancial_News) utiles pour les dividendes :
//  - DIVIDEND_NOTICE : avis de dividende / fermeture du registre / date de paiement,
//  - CORPORATE_ACTION : avis « Corporate Action » ou « Board approval » dont le titre ne dit pas « dividend »,
//  - AGM_NOTICE : convocation d'AGM (« To declare a final dividend of ... »),
//  - RESULTS_RELEASE : communiqué de résultats annuels (« FY 20xx earnings release »).
import type { NgxListItem } from "./types";

export type DisclosureKind = "DIVIDEND_NOTICE" | "CORPORATE_ACTION" | "AGM_NOTICE" | "RESULTS_RELEASE";

const DIVIDEND_RE = /DIVIDEND|CLOSURE\s+OF\s+(?:THE\s+)?(?:REGISTER|BOOKS|TRANSFER)|REGISTER\s+CLOSURE|QUALIFICATION\s+DATE|BOOK\s+CLOSURE/;
const EXCLUDE_RE = /DIVIDEND\s+POLICY|DIVIDEND\s+MANDATE|E-?DIVIDEND\s+(?:MANDATE|REGISTRATION)|UNCLAIMED|CLAIM\s+YOUR/;
const RESULTS_RE = /(?:FULL[\s-]*YEAR|FY|ANNUAL|YEAR[\s-]*END(?:ED)?)\s*(?:20\d\d\s*)?(?:AUDITED\s+)?(?:RESULTS?|EARNINGS|FINANCIAL\s+RESULTS|PRESS\s+RELEASE|PERFORMANCE)|EARNINGS?\s+RELEASE|AUDITED\s+(?:FULL\s+YEAR\s+)?RESULTS?|RESULTS?\s+FOR\s+THE\s+YEAR/;
const INTERIM_RE = /\bQ[1-3]\b|QUARTER\s*[1-3]\b|FIRST\s+QUARTER|SECOND\s+QUARTER|THIRD\s+QUARTER|HALF[\s-]*YEAR|\bH1\b|\bHY\b|9\s*M|NINE\s+MONTHS|THREE\s+MONTHS|SIX\s+MONTHS|UNAUDITED/;
const AMBIG_RE = /CORPORATE\s+(?:ACTION|DISCLOSURE)|BOARD\s+APPROVAL|APPROVAL\s+OF|PAYMENT|\bFINAL\b|BONUS|AUDITED\s+(?:FINANCIAL|ACCOUNTS)/;

const normType = (t: string | null) => (t ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export function classifyDisclosure(item: NgxListItem): DisclosureKind | null {
  const title = (item.URL?.Description ?? "").toUpperCase();
  const sub = normType(item.Type_of_Submission);
  if (!item.URL?.Url || !/\.pdf(?:$|\?)/i.test(item.URL.Url)) return null;
  if (/annual general meeting|\(agm\)/.test(sub)) return /RESULT|REPORT\s+AND\s+ACCOUNTS|PROXY|ATTENDANCE|MINUTES|DIRECTORS|ELECTRONIC/.test(title) ? null : "AGM_NOTICE";
  const isCA = /corporate action/.test(sub);
  const isFS = /financial statements/.test(sub);
  if (!isCA && !isFS) return null;
  if (DIVIDEND_RE.test(title) && !EXCLUDE_RE.test(title)) return "DIVIDEND_NOTICE";
  if (RESULTS_RE.test(title) && !(INTERIM_RE.test(title) && !/FULL[\s-]*YEAR|ANNUAL/.test(title))) return "RESULTS_RELEASE";
  if (isCA && AMBIG_RE.test(title) && !INTERIM_RE.test(title)) return "CORPORATE_ACTION";
  return null;
}
