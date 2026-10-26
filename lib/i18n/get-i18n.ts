import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from "./config";
import { createI18n } from "./create-i18n";

export function getLocale(): Locale {
  const cookie = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const header = headers().get(LOCALE_HEADER);
  if (isLocale(header)) return header;
  return DEFAULT_LOCALE;
}

export function getI18n() {
  return createI18n(getLocale());
}
