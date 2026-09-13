import type { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import PageHeader from "@/components/ui/PageHeader";
import styles from "./AuthForm.module.css";

type Props = {
  kicker?: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
};

export default function AuthPage({ kicker = "Compte", title, lead, children }: Props) {
  return (
    <AppHeader>
      <div className={`ob-page ${styles.wrap}`}>
        <PageHeader kicker={kicker} title={title} lead={lead} />
        <div className={`ob-card ob-card-pad ${styles.card}`}>{children}</div>
      </div>
    </AppHeader>
  );
}
