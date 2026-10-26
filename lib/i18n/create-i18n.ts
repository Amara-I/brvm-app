import type { Locale } from "./config";
import { createFormat } from "./format";
import { createLabels } from "./labels";
import { en } from "./messages/en";
import { fr, type Messages } from "./messages/fr";
import { createTranslator, type DotPaths, type TranslateVars } from "./translate";

export function getMessages(locale: Locale): Messages {
  return (locale === "en" ? en : fr) as Messages;
}

export function createI18n(locale: Locale, messages: Messages = getMessages(locale)) {
  return {
    locale,
    messages,
    t: createTranslator(messages),
    format: createFormat(locale),
    labels: createLabels(locale),
  };
}

export type I18nApi = ReturnType<typeof createI18n>;
export type TFunc = (path: DotPaths<Messages>, vars?: TranslateVars) => string;
