import Link from "next/link";
import type { AfricanExchange } from "@/lib/markets/african-exchanges";
import marketStyles from "@/components/marche/MarketChrome.module.css";
import styles from "@/components/marche/MarketBoard.module.css";
import { getI18n } from "@/lib/i18n/get-i18n";

export default function ComingSoonMarketPanel({
  exchange,
  topic = "marche",
}: {
  exchange: AfricanExchange;
  topic?: "marche" | "indices";
}) {
  const { t } = getI18n();
  const isIndices = topic === "indices";
  const market = exchange.shortLabel;
  return (
    <div className={marketStyles.comingSoon} role="status">
      <h1 className={marketStyles.comingTitle}>
        {isIndices
          ? t("market.comingSoon.indicesTitle", { market })
          : t("market.comingSoon.marketTitle", { market })}
      </h1>
      <p className={marketStyles.comingBody}>
        {isIndices
          ? t("market.comingSoon.indicesBody", { market })
          : t("market.comingSoon.marketBody")}
      </p>
      <Link
        href={isIndices ? "/indices" : "/marche"}
        className={`${styles.primaryBtn} ${marketStyles.comingCta}`}
        data-analytics-feature="coming_soon_market"
        data-analytics-action={isIndices ? "cta_indices_brvm" : "cta_brvm"}
      >
        {isIndices ? t("market.comingSoon.viewBrvmIndices") : t("market.comingSoon.showBrvm")}
      </Link>
    </div>
  );
}
