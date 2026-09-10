import Link from "next/link";
import { getTermBySlug } from "@/lib/education/catalog";

type Props = {
  slug: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/** Lien discret vers la fiche Éducation d’un terme technique. */
export default function EducationTermLink({ slug, children, className, style }: Props) {
  const term = getTermBySlug(slug);
  if (!term) return <>{children ?? slug}</>;

  return (
    <Link
      href={`/education/${term.themeSlug}/${term.slug}`}
      className={className}
      title={`En savoir plus : ${term.title}`}
      style={{
        color: "inherit",
        textDecoration: "underline",
        textDecorationStyle: "dotted",
        textUnderlineOffset: "2px",
        ...style,
      }}
    >
      {children ?? term.title}
    </Link>
  );
}

export function educationTermHref(slug: string): string | null {
  const term = getTermBySlug(slug);
  if (!term) return null;
  return `/education/${term.themeSlug}/${term.slug}`;
}

/** Slugs Éducation pour les colonnes du tableau portefeuille. */
export const PORTFOLIO_TABLE_TERM_SLUGS: Record<string, string> = {
  pru: "pru",
  cost: "cout-d-achat",
  unitPrice: "cours-au",
  value: "valeur-de-marche",
  asOf: "cours-au",
  horizon: "horizon-d-achat",
  pnl: "plus-moins-value-latente",
  score: "score-composite",
  advice: "conseil-portefeuille",
};
