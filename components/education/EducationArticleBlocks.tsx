import type { EducationContentBlock } from "@/lib/education/portfolio-type-articles";
import styles from "./Education.module.css";

export default function EducationArticleBlocks({ blocks }: { blocks: EducationContentBlock[] }) {
  return (
    <div className={styles.articleBlocks}>
      {blocks.map((block, i) => {
        const key = `${block.type}-${i}`;
        switch (block.type) {
          case "p":
            return (
              <p key={key} className={styles.sectionBody}>
                {block.text}
              </p>
            );
          case "h2":
            return (
              <h2 key={key} className={styles.articleH2}>
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={key} className={styles.articleH3}>
                {block.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={key} className={styles.articleList}>
                {block.items.map((item) => (
                  <li key={item.slice(0, 48)}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className={styles.articleList}>
                {block.items.map((item) => (
                  <li key={item.slice(0, 48)}>{item}</li>
                ))}
              </ol>
            );
          case "formula":
            return (
              <figure key={key} className={styles.formulaBox}>
                {block.label ? <figcaption className={styles.formulaLabel}>{block.label}</figcaption> : null}
                <p className={styles.formulaText}>{block.text}</p>
              </figure>
            );
          case "callout":
            return (
              <p
                key={key}
                className={
                  block.tone === "warn"
                    ? styles.calloutWarn
                    : block.tone === "tip"
                      ? styles.calloutTip
                      : styles.calloutInfo
                }
              >
                {block.text}
              </p>
            );
          case "table":
            return (
              <figure key={key} className={styles.tableWrap}>
                {block.caption ? <figcaption className={styles.tableCaption}>{block.caption}</figcaption> : null}
                <div className={styles.tableScroll}>
                  <table className={styles.articleTable}>
                    <thead>
                      <tr>
                        {block.headers.map((h) => (
                          <th key={h} scope="col">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, ri) => (
                        <tr key={row.join("|") + ri}>
                          {row.map((cell, ci) => (
                            <td key={`${ci}-${cell.slice(0, 24)}`} data-label={block.headers[ci]}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {block.footnote ? <p className={styles.tableFoot}>{block.footnote}</p> : null}
              </figure>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
