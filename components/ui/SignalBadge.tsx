type Props = {
  label: "ACHAT FORT" | "ACHAT" | "CONSERVER" | "ALLÉGER" | "VENDRE";
  title?: string;
};

/** Pastille de signal — libellés français non négociables. */
export default function SignalBadge({ label, title }: Props) {
  return (
    <span className="ob-signal" data-signal={label} title={title}>
      {label}
    </span>
  );
}
