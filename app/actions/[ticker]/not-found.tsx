import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";

export default function ActionNotFound() {
  return (
    <AppHeader>
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: 32 }}>
        <h1 style={{ color: C.text, fontSize: "1.3rem" }}>Société introuvable</h1>
        <p style={{ color: C.textDim, fontSize: "0.9rem", marginBottom: 20 }}>
          Ce ticker n&apos;existe pas dans la base OuestBourse, ou n&apos;est plus actif.
        </p>
        <Link href="/societes-cotees" style={{ color: C.gold, fontWeight: 700 }}>
          Voir les sociétés cotées →
        </Link>
      </div>
    </AppHeader>
  );
}
