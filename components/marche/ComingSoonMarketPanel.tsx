import Link from "next/link";
import type { AfricanExchange } from "@/lib/markets/african-exchanges";
import marketStyles from "@/components/marche/MarketChrome.module.css";
import styles from "@/components/marche/MarketBoard.module.css";

export default function ComingSoonMarketPanel({
  exchange,
  topic = "marche",
}: {
  exchange: AfricanExchange;
  topic?: "marche" | "indices";
}) {
  const isIndices = topic === "indices";
  return (
    <div className={marketStyles.comingSoon} role="status">
      <h1 className={marketStyles.comingTitle}>
        {isIndices ? `Indices ${exchange.shortLabel} — bientôt` : `${exchange.shortLabel} — bientôt`}
      </h1>
      <p className={marketStyles.comingBody}>
        {isIndices
          ? `Les indices de ${exchange.shortLabel} seront listés ici dès que la couverture sera disponible. En attendant, consultez les indices BRVM.`
          : "Couverture en cours. Explorez la BRVM en attendant."}
      </p>
      <Link
        href={isIndices ? "/indices" : "/marche"}
        className={`${styles.primaryBtn} ${marketStyles.comingCta}`}
      >
        {isIndices ? "Voir les indices BRVM" : "Afficher la BRVM"}
      </Link>
    </div>
  );
}
