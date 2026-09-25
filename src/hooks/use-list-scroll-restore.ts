"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

const SCROLL_POS_KEY = "qcet_task_list_scroll_y";
const QUERY_PARAMS_KEY = "qcet_task_list_query_params";

export interface ListScrollRestoreReturn {
  saveScrollAndParams: () => void;
  restoreScrollAndNavigateBack: (fallbackPath?: string) => void;
}

export function useListScrollRestore(): ListScrollRestoreReturn {
  let router: ReturnType<typeof useRouter> | null = null;
  let searchParams: ReturnType<typeof useSearchParams> | null = null;
  try {
    router = useRouter();
  } catch {
    // App router context not mounted
  }
  try {
    searchParams = useSearchParams();
  } catch {
    // Search params context not mounted
  }

  const saveScrollAndParams = React.useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      sessionStorage.setItem(SCROLL_POS_KEY, String(scrollY));

      const paramsStr = searchParams ? searchParams.toString() : "";
      if (paramsStr) {
        sessionStorage.setItem(QUERY_PARAMS_KEY, paramsStr);
      }
    } catch {
      // Safe fallback if sessionStorage is inaccessible
    }
  }, [searchParams]);

  const restoreScrollAndNavigateBack = React.useCallback(
    (fallbackPath: string = "/portal") => {
      if (typeof window === "undefined") {
        if (router) router.push(fallbackPath);
        return;
      }

      try {
        const savedParams = sessionStorage.getItem(QUERY_PARAMS_KEY);
        const targetUrl = savedParams
          ? `${fallbackPath}?${savedParams}`
          : fallbackPath;

        const savedScroll = sessionStorage.getItem(SCROLL_POS_KEY);

        // Listen for next frame after navigation to restore scroll
        if (savedScroll) {
          const scrollY = parseInt(savedScroll, 10);
          if (!isNaN(scrollY) && scrollY > 0) {
            setTimeout(() => {
              window.scrollTo({ top: scrollY, behavior: "instant" });
            }, 100);
          }
        }

        if (router) {
          router.push(targetUrl);
        } else {
          window.location.href = targetUrl;
        }
      } catch {
        if (router) {
          router.push(fallbackPath);
        } else {
          window.location.href = fallbackPath;
        }
      }
    },
    [router]
  );

  return {
    saveScrollAndParams,
    restoreScrollAndNavigateBack,
  };
}
