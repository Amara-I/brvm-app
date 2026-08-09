// Page "Sociétés cotées" — étape 10 (navigation complète).
// Liste complète des sociétés, à partir des mêmes données canoniques que le
// dashboard (`getCompaniesFullDataset()`), sans logique de calcul additionnelle.
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sociétés cotées — ouestBourse",
  description: "Liste des sociétés cotées à la BRVM suivies par ouestBourse, par pays et secteur.",
};

export default async function SocietesCoteesPage() {
  const { companies, years } = await getCompaniesFullDataset();
  const lastYear = years[years.length - 1];
  const sorted = [...companies].sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Trebuchet MS', Georgia, serif" }}>
      <AppHeader />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ color: C.text, fontSize: "1.4rem", marginBottom: 4 }}>🏢 Sociétés cotées</h1>
        <p style={{ color: C.textDim, fontSize: "0.85rem", marginBottom: 24 }}>
          {sorted.length} sociétés suivies à la BRVM (Bourse Régionale des Valeurs Mobilières).
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ color: C.textDim, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>
                <th scope="col" style={{ padding: "8px 6px" }}>Société</th>
                <th scope="col" style={{ padding: "8px 6px" }}>Ticker</th>
                <th scope="col" style={{ padding: "8px 6px" }}>Pays</th>
                <th scope="col" style={{ padding: "8px 6px" }}>Secteur</th>
                <th scope="col" style={{ padding: "8px 6px" }}>Cours ({lastYear ?? "N/D"})</th>
                <th scope="col" style={{ padding: "8px 6px" }}>Capitalisation</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((co) => {
                const price = lastYear ? co.prices[lastYear] : undefined;
                return (
                  <tr key={co.ticker} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 6px", color: C.text }}>{co.name}</td>
                    <td style={{ padding: "8px 6px", color: C.gold, fontWeight: 700 }}>{co.ticker}</td>
                    <td style={{ padding: "8px 6px", color: C.textDim }}>
                      {co.countryFlag} {co.country}
                    </td>
                    <td style={{ padding: "8px 6px", color: C.textDim }}>{co.sector}</td>
                    <td style={{ padding: "8px 6px", color: C.text }}>{price ? `${price.toLocaleString("fr-FR")} FCFA` : "N/D"}</td>
                    <td style={{ padding: "8px 6px", color: C.text }}>{co.mktcap > 0 ? `${co.mktcap.toLocaleString("fr-FR")} Mds FCFA` : "N/D"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
