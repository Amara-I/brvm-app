// Page "Graphes" — étape 10 (navigation complète).
// Stub honnête : les graphiques Recharts existent déjà dans les onglets
// "Courbe historique" et "Comparaison" de `/marche`. Une page dédiée
// multi-graphiques (indices, secteurs) est une fonctionnalité future non
// développée ici — annoncée comme telle plutôt que simulée.
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";

export const metadata = {
  title: "Graphes — BRVM App",
  description: "Visualisations graphiques du marché BRVM.",
};

export default function GraphesPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Trebuchet MS', Georgia, serif" }}>
      <AppHeader />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "72px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "2.2rem", marginBottom: 12 }}>📈</div>
        <h1 style={{ color: C.text, fontSize: "1.3rem", marginBottom: 8 }}>Graphes multi-indices — bientôt disponible</h1>
        <p style={{ color: C.textDim, fontSize: "0.88rem", marginBottom: 24, lineHeight: 1.6 }}>
          Une vue graphique dédiée (indices BRVM Composite/BRVM 10, comparaison sectorielle) est en préparation. En attendant, les
          graphiques par société sont déjà disponibles dans les onglets <strong style={{ color: C.text }}>Courbe historique</strong>{" "}
          et <strong style={{ color: C.text }}>Comparaison</strong> du dashboard Marché.
        </p>
        <Link
          href="/marche"
          style={{ display: "inline-block", background: C.gold, color: "#080B12", fontWeight: 700, borderRadius: 6, padding: "10px 20px", textDecoration: "none", fontSize: "0.85rem" }}
        >
          Aller au Marché →
        </Link>
      </div>
    </div>
  );
}
