"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function SignOutClient() {
  useEffect(() => {
    void signOut({ callbackUrl: "/", redirect: true }).catch(() => {
      window.location.assign(`/api/auth/signout?callbackUrl=${encodeURIComponent("/")}`);
    });
  }, []);

  return <p style={{ margin: 0, color: "var(--c-textdim)" }}>Vous allez être redirigé vers l’accueil.</p>;
}
