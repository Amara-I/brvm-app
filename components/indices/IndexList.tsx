import Link from "next/link";
import ChangeValue from "@/components/ui/ChangeValue";
import EmptyState from "@/components/ui/EmptyState";
import { groupIndicesByFamily, type MarketIndexListItem } from "@/lib/api/market-indices";
import styles from "./Indices.module.css";

function formatLevel(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "N/D";
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null): string {
  if (!iso) return "N/D";
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "N/D";
  return parsed.toLocaleDateString("fr-FR");
}

export default function IndexList({ items }: { items: MarketIndexListItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucun indice en base"
        body="Les niveaux BRVM (Composite, BRVM 30, sectoriels) s’afficheront après ingestion. Aucun chiffre n’est inventé."
      />
    );
  }

  const groups = groupIndicesByFamily(items);

  return (
    <div className={styles.stack}>
      {groups.map((group) => (
        <section key={group.family} className={styles.group} aria-labelledby={`idx-${group.family}`}>
          <h2 id={`idx-${group.family}`} className={styles.groupTitle}>
            {group.label}
            <span className={styles.groupCount}>{group.items.length}</span>
          </h2>
          <div className={styles.tableWrap}>
            <table className="ob-table">
              <thead>
                <tr>
                  <th scope="col">Indice</th>
                  <th scope="col">Dernier</th>
                  <th scope="col">Variation</th>
                  <th scope="col">Séance</th>
                  <th scope="col">Source</th>
                  <th scope="col">Historique</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.code}>
                    <td>
                      <Link href={`/indices/${item.code}`} className={styles.nameLink}>
                        <span className={styles.code}>{item.code.replace(/_/g, " ")}</span>
                        <span className={styles.name}>{item.name}</span>
                      </Link>
                    </td>
                    <td className="ob-num">{formatLevel(item.lastValue)}</td>
                    <td>
                      <ChangeValue value={item.changePercent} />
                    </td>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.sourceLabel}</td>
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
