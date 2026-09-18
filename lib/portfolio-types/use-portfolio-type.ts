"use client";

import {
  coercePortfolioType,
  DEFAULT_PORTFOLIO_TYPE,
  parsePortfolioType,
  readStoredPortfolioType,
  writeStoredPortfolioType,
  type PortfolioTypeId,
} from "@/lib/portfolio-types";
import { useCallback, useEffect, useState } from "react";

/**
 * Type de portefeuille pour l’analyse / simulation :
 * 1) dernier choix navigateur (localStorage) — surcharge libre
 * 2) préférence Profil (si connecté)
 * 3) Croissance par défaut
 */
export function usePortfolioType(preferredFromProfile?: PortfolioTypeId | null): {
  type: PortfolioTypeId;
  setType: (next: PortfolioTypeId) => void;
  profileDefault: PortfolioTypeId | null;
  isOverride: boolean;
  resetToProfile: () => void;
} {
  const profileDefault = parsePortfolioType(preferredFromProfile);
  const [type, setTypeState] = useState<PortfolioTypeId>(
    () => profileDefault ?? DEFAULT_PORTFOLIO_TYPE
  );

  useEffect(() => {
    const stored = readStoredPortfolioType();
    setTypeState(stored ?? profileDefault ?? DEFAULT_PORTFOLIO_TYPE);
  }, [profileDefault]);

  const setType = useCallback((next: PortfolioTypeId) => {
    const coerced = coercePortfolioType(next);
    setTypeState(coerced);
    writeStoredPortfolioType(coerced);
  }, []);

  const resetToProfile = useCallback(() => {
    if (!profileDefault) return;
    setType(profileDefault);
  }, [profileDefault, setType]);

  return {
    type,
    setType,
    profileDefault,
    isOverride: Boolean(profileDefault && type !== profileDefault),
    resetToProfile,
  };
}
