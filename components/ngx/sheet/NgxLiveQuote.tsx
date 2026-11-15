"use client";

// Cours d'une fiche NGX tenu à jour pendant que la page est ouverte : sondage
// /api/quotes (60 s en séance NGX, onglet visible) et relecture immédiate quand
// une notification arrive. Même dernier cours canonique que les notifications.

import { useCallback, useState } from "react";
import ChangeValue from "@/components/ui/ChangeValue";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useLiveQuotes } from "@/lib/ui/use-live-quotes";
import type { LatestQuote } from "@/lib/quotes/types";

export interface NgxLiveQuoteProps {
  ticker: string;
  close: number | null;
  changePercent: number | null;
  priceClassName?: string;
}

export default function NgxLiveQuote({ ticker, close, changePercent, priceClassName }: NgxLiveQuoteProps) {
  const { format } = useI18n();
  const [quote, setQuote] = useState<{ close: number | null; changePercent: number | null }>({ close, changePercent });
  const onChange = useCallback(
    (changed: LatestQuote[]) => {
      const q = changed.find((item) => item.ticker === ticker.toUpperCase());
      if (!q || !(q.close > 0)) return;
      setQuote((prev) =>
        prev.close === q.close && prev.changePercent === q.changePercent
          ? prev
          : { close: q.close, changePercent: q.changePercent }
      );
    },
    [ticker]
  );
  useLiveQuotes({ market: "NGX", tickers: [ticker], onChange });

  return (
    <>
      <div className={priceClassName} data-testid="ngx-live-price">
        {quote.close == null ? "N/D" : format.money(quote.close, "NGN")}
      </div>
      <ChangeValue value={quote.changePercent} />
    </>
  );
}
