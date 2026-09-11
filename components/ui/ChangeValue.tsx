import { changeClassName, formatSignedPercent } from "@/lib/ui/format-change";

type Props = {
  value: number | null | undefined;
  digits?: number;
  pill?: boolean;
  title?: string;
};

/** Variation colorée (vert / rouge) — N/D si absente, jamais de chiffre inventé. */
export default function ChangeValue({ value, digits = 2, pill = false, title }: Props) {
  const text = formatSignedPercent(value, digits);
  const tone = changeClassName(value);
  const className = pill ? `ob-num ob-chg-pill ${tone}` : `ob-num ${tone}`;
  return (
    <span className={className} title={title}>
      {text}
    </span>
  );
}
