import type { NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "./config";

export function localeFromRequest(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const header = request.headers.get("x-ouestbourse-locale");
  if (isLocale(header)) return header;
  return negotiateLocale(request.headers.get("accept-language"));
}
