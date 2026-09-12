import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import IndexList from "@/components/indices/IndexList";
import PageHeader from "@/components/ui/PageHeader";
import { getMarketIndexList } from "@/lib/api/market-indices";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Indices BRVM — OuestBourse",
  description: "Indices de la BRVM : niveaux, variations et historique (Composite, BRVM 30, sectoriels).",
};

export default async function IndicesPage() {
  const items = await getMarketIndexList();
  const withLevel = items.filter((item) => item.lastValue != null).length;

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker="BRVM · UEMOA"
          title="Indices"
          lead={
            <>
              Niveaux officiels réconciliés (BRVM.org prioritaire, puis Sikafinance).{" "}
              {items.length > 0
                ? `${withLevel} indice${withLevel > 1 ? "s" : ""} avec un dernier niveau en base.`
                : "Aucun niveau en base pour l’instant."}{" "}
              Une donnée absente s’affiche N/D.
            </>
          }
        />
        <IndexList items={items} />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
