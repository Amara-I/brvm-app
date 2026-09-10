import AppHeader from "@/components/AppHeader";
import DailyDesignPreviewClient from "@/components/design-preview/DailyDesignPreviewClient";
import DesignPreviewClient from "@/components/design-preview/DesignPreviewClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aperçu design — OuestBourse",
  description:
    "Avant / après des propositions App Designer — aperçu uniquement, non appliqué aux pages produit.",
};

export default function ApercuDesignPage() {
  return (
    <AppHeader>
      <DailyDesignPreviewClient />
      <DesignPreviewClient />
    </AppHeader>
  );
}
