import { intlLocale, type Locale } from "./config";

export type FormatApi = ReturnType<typeof createFormat>;

function numberFormat(locale: Locale, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  return new Intl.NumberFormat(intlLocale(locale), options);
}

export function createFormat(locale: Locale) {
  const tag = intlLocale(locale);

  function number(value: number, options?: Intl.NumberFormatOptions): string {
    if (!Number.isFinite(value)) return "N/D";
    return numberFormat(locale, options).format(value);
  }

  function integer(value: number): string {
    if (!Number.isFinite(value)) return "N/D";
    return number(Math.round(value), { maximumFractionDigits: 0 });
  }

  function decimal(value: number, digits = 2): string {
    if (!Number.isFinite(value)) return "N/D";
    return number(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function signed(value: number, digits = 2): string {
    if (!Number.isFinite(value)) return "N/D";
    const body = decimal(Math.abs(value), digits);
    if (value > 0) return `+${body}`;
    if (value < 0) return `-${body}`;
    return body;
  }

  return {
    locale,
    tag,
    number,
    integer,
    decimal,
    signed,
    /** Points de pourcentage déjà en % (12.5 → « 12,5 % » / « 12.5% »). */
    percent(value: number, digits = 2, withSign = false): string {
      if (!Number.isFinite(value)) return "N/D";
      const body = withSign ? signed(value, digits) : decimal(value, digits);
      return locale === "en" ? `${body}%` : `${body} %`;
    },
    fcfa(value: number): string {
      if (!Number.isFinite(value)) return "N/D";
      return `${integer(value)} FCFA`;
    },
    /** Capitalisation en milliards de FCFA. « Mds FCFA » reste le libellé français. */
    mdsFcfa(value: number): string {
      if (!Number.isFinite(value)) return "N/D";
      const digits = Number.isInteger(value) ? 0 : 2;
      const body = number(value, { minimumFractionDigits: digits, maximumFractionDigits: 2 });
      return locale === "en" ? `${body} bn FCFA` : `${body} Mds FCFA`;
    },
    date(input: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions): string {
      if (input == null || input === "") return "N/D";
      const date = input instanceof Date ? input : new Date(input);
      if (Number.isNaN(date.getTime())) return "N/D";
      return new Intl.DateTimeFormat(
        tag,
        options ?? { day: "numeric", month: "short", year: "numeric" }
      ).format(date);
    },
    dateTime(input: Date | string | number | null | undefined): string {
      if (input == null || input === "") return "N/D";
      const date = input instanceof Date ? input : new Date(input);
      if (Number.isNaN(date.getTime())) return "N/D";
      return new Intl.DateTimeFormat(tag, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    },
  };
}
