// Logos locaux des sociétés BRVM (public/logos/brvm/{TICKER}.webp).
// Généré par scripts/brvm/fetch-logos.py — ne pas éditer à la main.
export const BRVM_LOGO_TICKERS: ReadonlySet<string> = new Set([
  "ABJC",
  "BBGCI",
  "BICB",
  "BICC",
  "BNBC",
  "BOAB",
  "BOABF",
  "BOAC",
  "BOAM",
  "BOAN",
  "BOAS",
  "CBIBF",
  "CFAC",
  "CIEC",
  "ECOC",
  "ETIT",
  "FTSC",
  "LNBB",
  "NEIC",
  "NSBC",
  "NTLC",
  "ONTBF",
  "ORAC",
  "PALC",
  "PRSC",
  "SAFC",
  "SDCC",
  "SDSC",
  "SGBC",
  "SHEC",
  "SIBC",
  "SIVC",
  "SLBC",
  "SMBC",
  "SNTS",
  "SOGC",
  "SPHC",
  "STAC",
  "STBC",
  "TTLC",
  "TTLS",
  "UNLC",
  "UNXC",
]);

export function brvmLogoSrc(ticker: string | null | undefined): string | null {
  if (!ticker) return null;
  const t = ticker.trim().toUpperCase();
  return BRVM_LOGO_TICKERS.has(t) ? `/logos/brvm/${t}.webp` : null;
}
