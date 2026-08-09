"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Liens de navigation du header interne — étape 10 (navigation complète)
// ═══════════════════════════════════════════════════════════════════════════
// Composant client isolé (le reste de `AppHeader` reste un Server Component)
// uniquement pour pouvoir mettre en surbrillance le lien actif via
// `usePathname()`. Aucune donnée sensible ici, pas d'appel réseau.
// ═══════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { usePathname } from "next/navigation";
import { C } from "@/lib/theme/colors";

const NAV_ITEMS = [
  { href: "/marche", label: "Marché" },
  { href: "/screener", label: "Screener" },
  { href: "/portefeuille", label: "Portefeuille" },
  { href: "/graphes", label: "Graphes" },
  { href: "/societes-cotees", label: "Sociétés cotées" },
  { href: "/actualites", label: "Actualités" },
  { href: "/outils", label: "Outils" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            style={{
              color: active ? C.gold : C.textDim,
              textDecoration: "none",
              fontSize: "0.85rem",
              padding: "6px 10px",
              borderRadius: 6,
              background: active ? "rgba(212,168,67,0.1)" : "transparent",
              border: `1px solid ${active ? C.gold : "transparent"}`,
              transition: "color 0.15s, border-color 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
