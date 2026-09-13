import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Réglages — OuestBourse",
};

/** Alias de /profil#alertes — même page de préférences. */
export default function ReglagesPage() {
  redirect("/profil#alertes");
}
