// Légende des niveaux, sous le graphe : repère court (le même que sur le tracé),
// libellé complet, prix ou fourchette, écart au cours. Le graphe garde des repères discrets.

import styles from "./LevelLegend.module.css";

export interface LevelLegendItem {
  key: string;
  /** Repère affiché sur le graphe (R1, O2, I…). */
  short: string;
  /** Couleur du repère (hex ou variable CSS). */
  color: string;
  name: string;
  value: string;
  distance?: string | null;
  /** Couleur de l'écart : objectif = vert, invalidation = rouge (quel que soit le signe). */
  distanceTone?: "good" | "bad";
}

export default function LevelLegend({
  title,
  items,
  className,
  tone = "app",
}: {
  title: string;
  items: LevelLegendItem[];
  className?: string;
  /** "chart" : palette du graphe sombre (workbench), "app" : variables du thème. */
  tone?: "app" | "chart";
}) {
  if (items.length === 0) return null;
  return (
    <section className={`${styles.legend} ${tone === "chart" ? styles.toneChart : ""} ${className ?? ""}`} aria-label={title}>
      <h5 className={styles.title}>{title}</h5>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.key} className={styles.row}>
            <span className={styles.short} style={{ background: item.color }}>
              {item.short}
            </span>
            <span className={styles.name}>{item.name}</span>
            <span className={styles.value}>
              {item.value}
              {item.distance ? (
                <span className={styles.pct} style={{
                    color:
                      (item.distanceTone ?? (item.distance.startsWith("−") ? "bad" : "good")) === "bad"
                        ? "var(--lv-red)"
                        : "var(--lv-green)",
                  }}>
                  {item.distance}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
