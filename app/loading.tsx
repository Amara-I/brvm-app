// Squelette affiché pendant le rendu serveur de n'importe quelle page :
// Next l'enveloppe dans un <Suspense>, ce qui permet de streamer la page au
// lieu d'afficher un écran blanc tant que les requêtes Postgres ne sont pas
// terminées. Les routes qui ont leur propre `loading.tsx` le remplacent.
import { PageSkeleton } from "@/components/ui/SkeletonBlock";
import { getI18n } from "@/lib/i18n/get-i18n";

export default function Loading() {
  const { t } = getI18n();
  return <PageSkeleton label={t("common.loading")} />;
}
