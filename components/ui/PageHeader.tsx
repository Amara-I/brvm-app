import type { ReactNode } from "react";

type Props = {
  kicker?: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
};

/** En-tête de page produit — gauche, kicker, titre, chapô, actions. */
export default function PageHeader({ kicker, title, lead, actions }: Props) {
  return (
    <header className="ob-page-header">
      {kicker ? <p className="ob-kicker">{kicker}</p> : null}
      <div className="ob-page-header-row">
        <h1 className="ob-page-title">{title}</h1>
        {actions ? <div>{actions}</div> : null}
      </div>
      {lead ? <p className="ob-page-lead">{lead}</p> : null}
    </header>
  );
}
