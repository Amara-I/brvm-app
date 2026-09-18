"use client";

import { useEffect } from "react";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { parsePortfolioType, type PortfolioTypeId } from "./types";

const STORAGE_KEY = "ouestbourse:portfolio-type-lens";

/** Type affiché (Analyses / Simulations) : préférence profil, surcharge locale possible. */
export function usePortfolioTypeLens(savedType: PortfolioTypeId | null): {
  value: PortfolioTypeId | null;
  setValue: (next: PortfolioTypeId | null) => void;
} {
  const [raw, setRaw] = usePersistedState(STORAGE_KEY, savedType ?? "");

  useEffect(() => {
    if (!raw && savedType) setRaw(savedType);
  }, [raw, savedType, setRaw]);

  return {
    value: parsePortfolioType(raw),
    setValue: (next) => setRaw(next ?? ""),
  };
}
