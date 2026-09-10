"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { pageScrollKey, restoreScrollPosition, saveScrollPosition } from "@/lib/ui/scroll-restoration";

/** `router.refresh()` sans remonter en haut de page. */
export function useAppRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = pageScrollKey(pathname, searchParams.toString());

  return useCallback(() => {
    saveScrollPosition(key);
    router.refresh();
    restoreScrollPosition(key);
  }, [router, key]);
}
