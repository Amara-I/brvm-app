import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("auth.settings.metaTitle") };
}

/** Alias de /profil#alertes — même page de préférences. */
export default function ReglagesPage() {
  redirect("/profil#alertes");
}
