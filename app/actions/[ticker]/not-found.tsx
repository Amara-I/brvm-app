import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { getI18n } from "@/lib/i18n/get-i18n";
import { C } from "@/lib/theme/colors";

export default function ActionNotFound() {
  const { t } = getI18n();
  return (
    <AppHeader>
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: 32 }}>
        <h1 style={{ color: C.text, fontSize: "1.3rem" }}>{t("company.notFound.title")}</h1>
        <p style={{ color: C.textDim, fontSize: "0.9rem", marginBottom: 20 }}>{t("company.notFound.body")}</p>
        <Link href="/societes-cotees" style={{ color: C.gold, fontWeight: 700 }}>
          {t("company.notFound.cta")}
        </Link>
      </div>
    </AppHeader>
  );
}
