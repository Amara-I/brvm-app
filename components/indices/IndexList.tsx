import Link from "next/link";
import ChangeValue from "@/components/ui/ChangeValue";
import EmptyState from "@/components/ui/EmptyState";
import { translateIndexFamily } from "@/components/indices/index-copy";
import { translateDataSourceLabel } from "@/components/marche/market-copy";
import { groupIndicesByFamily, type MarketIndexListItem } from "@/lib/api/market-indices";
import { getI18n } from "@/lib/i18n/get-i18n";
import styles from "./Indices.module.css";

const NUMERIC_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
};

export default function IndexList({
  items,
  hrefFor = (code) => `/indices/${code}`,
}: {
  items: MarketIndexListItem[];
  hrefFor?: (code: string) => string;
}) {
  const { t, format } = getI18n();

  if (items.length === 0) {
    return <EmptyState title={t("market.indices.emptyTitle")} body={t("market.indices.emptyBody")} />;
  }

  const groups = groupIndicesByFamily(items);

  return (
    <div className={styles.stack}>
      {groups.map((group) => (
        <section key={group.family} className={styles.group} aria-labelledby={`idx-${group.family}`}>
          <h2 id={`idx-${group.family}`} className={styles.groupTitle}>
            {translateIndexFamily(group.family, t)}
            <span className={styles.groupCount}>{group.items.length}</span>
          </h2>
          <div className={styles.tableWrap}>
            <table className="ob-table">
              <thead>
                <tr>
                  <th scope="col">{t("market.indices.col.index")}</th>
                  <th scope="col">{t("market.indices.col.last")}</th>
                  <th scope="col">{t("market.indices.col.change")}</th>
                  <th scope="col">{t("market.indices.col.session")}</th>
                  <th scope="col">{t("common.source")}</th>
                  <th scope="col">{t("market.indices.col.history")}</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.code}>
                    <td>
                      <Link href={hrefFor(item.code)} className={styles.nameLink}>
                        <span className={styles.code}>{item.code.replace(/_/g, " ")}</span>
                        <span className={styles.name}>{item.name}</span>
                      </Link>
                    </td>
                    <td className="ob-num">
                      {item.lastValue == null ? "N/D" : format.decimal(item.lastValue, 2)}
                    </td>
                    <td>
                      <ChangeValue value={item.changePercent} />
                    </td>
                    <td>
                      {item.date
                        ? format.date(`${item.date}T00:00:00.000Z`, NUMERIC_DATE)
                        : "N/D"}
                    </td>
                    <td>{translateDataSourceLabel(item.sourceLabel, t)}</td>
                    <td className="ob-num">{item.historyPoints > 0 ? item.historyPoints : "N/D"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
