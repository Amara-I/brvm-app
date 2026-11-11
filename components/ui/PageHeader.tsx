import type { ReactNode } from "react";

type Props = {
  kicker?: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  /** Signe visuel à gauche du titre (logo ou monogramme). */
  mark?: ReactNode;
};

/** En-tête de page produit — gauche, kicker, titre, chapô, actions. */
export default function PageHeader({ kicker, title, lead, actions, mark }: Props) {
  return (
    <header className="ob-page-header">
      {kicker ? <p className="ob-kicker">{kicker}</p> : null}
      <div className="ob-page-header-row">
        <div className="ob-page-header-title">
          {mark}
          <h1 className="ob-page-title">{title}</h1>
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      {lead ? <p className="ob-page-lead">{lead}</p> : null}
    </header>
  );
}
