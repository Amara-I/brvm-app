import type { LatexPiece, MdInline } from "@/lib/education/markdown";
import { parseEducationMarkdown, parseInlineMarkdown, parseLatexPieces } from "@/lib/education/markdown";
import styles from "./Education.module.css";

function LatexView({ pieces }: { pieces: LatexPiece[] }) {
  return (
    <>
      {pieces.map((p, i) =>
        p.kind === "frac" ? (
          <span key={i} className={styles.frac}>
            <span className={styles.fracNum}>
              <LatexView pieces={p.num} />
            </span>
            <span className={styles.fracDen}>
              <LatexView pieces={p.den} />
            </span>
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </>
  );
}

function Inline({ text }: { text: string }) {
  const parts: MdInline[] = parseInlineMarkdown(text);
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "strong") return <strong key={i}>{p.text}</strong>;
        if (p.type === "em") return <em key={i}>{p.text}</em>;
        if (p.type === "code") return <code key={i}>{p.text}</code>;
        if (p.type === "math") {
          return (
            <span key={i} className={styles.mathInline} title={p.latex}>
              <LatexView pieces={parseLatexPieces(p.latex)} />
            </span>
          );
        }
        if (p.type === "link") {
          const external = /^https?:\/\//i.test(p.href);
          return (
            <a
              key={i}
              href={p.href}
              className={styles.mdLink}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {p.text}
            </a>
          );
        }
        return <span key={i}>{p.text}</span>;
      })}
    </>
  );
}

export default function EducationMarkdown({ source }: { source: string }) {
  const blocks = parseEducationMarkdown(source);
  return (
    <div className={styles.md}>
      {blocks.map((b, i) => {
        if (b.type === "h2") {
          return (
            <h2 key={i} className={styles.mdH2}>
              <Inline text={b.text} />
            </h2>
          );
        }
        if (b.type === "h3") {
          return (
            <h3 key={i} className={styles.mdH3}>
              <Inline text={b.text} />
            </h3>
          );
        }
        if (b.type === "p") {
          return (
            <p key={i} className={styles.mdP}>
              <Inline text={b.text} />
            </p>
          );
        }
        if (b.type === "ul") {
          return (
            <ul key={i} className={styles.mdList}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={i} className={styles.mdList}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </ol>
          );
        }
        if (b.type === "table") {
          return (
            <div key={i} className={styles.mdTableWrap}>
              <table className={styles.mdTable}>
                <thead>
                  <tr>
                    {b.headers.map((h) => (
                      <th key={h} scope="col">
                        <Inline text={h} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c}>
                          <Inline text={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.type === "math") {
          return (
            <div key={i} className={styles.mathBlock} title={b.latex}>
              <LatexView pieces={parseLatexPieces(b.latex)} />
            </div>
          );
        }
        return <hr key={i} className={styles.mdHr} />;
      })}
    </div>
  );
}
