"use client";

import { useState } from "react";
import SignOutButton from "@/components/auth/SignOutButton";

/** Affiche le même dialogue que le header, centré dans le viewport. */
export default function SignOutClient() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <p style={{ margin: "0 0 14px", color: "var(--c-textdim)" }}>
        Confirmez pour fermer la session et revenir à l’accueil.
      </p>
      <SignOutButton hideTrigger open={open} onOpenChange={setOpen} />
    </>
  );
}
