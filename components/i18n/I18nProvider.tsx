"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/config";
import { createI18n, type I18nApi } from "@/lib/i18n/create-i18n";
import type { Messages } from "@/lib/i18n/messages/fr";

const I18nContext = createContext<I18nApi | null>(null);

export default function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo(() => createI18n(locale, messages), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nApi {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n doit être utilisé sous I18nProvider");
  }
  return value;
}
