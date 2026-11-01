import Link from "next/link";
import type { LandingMarket } from "@/lib/api/landing-markets";
import { getI18n } from "@/lib/i18n/get-i18n";
import { dataSourceLabel } from "@/lib/api/data-source-label";
import styles from "./MarketOverviewCards.module.css";

export default function MarketOverviewCards({ markets }: { markets: LandingMarket[] }) {
  const { format } = getI18n();
  return <section className={styles.grid} aria-label="Marchés BRVM et NGX">
    {markets.map(({ exchange, count, index }) => <article key={exchange} className={styles.card}>
      <h2><Link href={exchange === "NGX" ? "/marches/ngx" : "/marche"}>{exchange}</Link></h2>
      <dl>
        <div><dt>{exchange === "NGX" ? "NGX All-Share" : "BRVM Composite"}</dt><dd>{index ? format.decimal(index.value, 2) : "N/D"}</dd></div>
        <div><dt>Variation de séance</dt><dd>{index?.changePercent != null ? format.percent(index.changePercent, 2, true) : "N/D"}</dd></div>
        <div><dt>Sociétés actives dans la base</dt><dd>{count ?? "N/D"}</dd></div>
        <div><dt>Capitalisation officielle ({exchange === "NGX" ? "NGN" : "XOF"})</dt><dd>N/D</dd></div>
      </dl>
      <p>Capitalisation agrégée officielle non disponible dans ce flux ; aucune somme partielle présentée comme un total.</p>
      <small>Source indice : {index ? dataSourceLabel(index.source) : "N/D"} · Séance : {index?.date ?? "N/D"}</small>
    </article>)}
  </section>;
}
