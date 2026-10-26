import type { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import PageHeader from "@/components/ui/PageHeader";
import { getI18n } from "@/lib/i18n/get-i18n";
import styles from "./AuthForm.module.css";

type Props = {
  kicker?: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
};

export default function AuthPage({ kicker, title, lead, children }: Props) {
  const { t } = getI18n();
  return (
    <AppHeader>
      <div className={`ob-page ${styles.wrap}`}>
        <PageHeader kicker={kicker ?? t("auth.kicker")} title={title} lead={lead} />
        <div className={`ob-card ob-card-pad ${styles.card}`}>{children}</div>
      </div>
    </AppHeader>
  );
}
