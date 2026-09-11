import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  padded?: boolean;
  className?: string;
};

export default function Surface({ children, padded = false, className }: Props) {
  const cls = ["ob-card", padded ? "ob-card-pad" : "", className].filter(Boolean).join(" ");
  return <div className={cls}>{children}</div>;
}
