import Link from "next/link";
import type { AfricanExchange } from "@/lib/markets/african-exchanges";
import marketStyles from "@/components/marche/MarketChrome.module.css";
import styles from "@/components/marche/MarketBoard.module.css";

export default function ComingSoonMarketPanel({ exchange }: { exchange: AfricanExchange }) {
  return (
    <div className={marketStyles.comingSoon} role="status">
      <h1 className={marketStyles.comingTitle}>
        {exchange.shortLabel} — bientôt
      </h1>
      <p className={marketStyles.comingBody}>
        Couverture en cours. Explorez la BRVM en attendant.
      </p>
      <Link href="/marche" className={`${styles.primaryBtn} ${marketStyles.comingCta}`}>
        Afficher la BRVM
      </Link>
    </div>
  );
}
