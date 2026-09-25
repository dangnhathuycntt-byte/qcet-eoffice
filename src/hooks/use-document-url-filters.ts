"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type DocumentTabType = "all" | "inbox" | "outbox" | "submission";

export interface DocumentUrlFilters {
  type: DocumentTabType;
  search: string;
  status: string;
  urgency: string;
  leadUnitId: string;
  documentYear?: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_DOCUMENT_URL_FILTERS: DocumentUrlFilters = {
  type: "all",
  search: "",
  status: "ALL",
  urgency: "ALL",
  leadUnitId: "",
  documentYear: undefined,
  page: 1,
  pageSize: 20,
};

export interface UseDocumentUrlFiltersOptions {
  defaultFilters?: Partial<DocumentUrlFilters>;
  debounceMs?: number;
  resetPageOnFilterChange?: boolean;
}

export interface UseDocumentUrlFiltersReturn {
  filters: DocumentUrlFilters;
  searchInputValue: string;
  isFiltered: boolean;
  isPending: boolean;
  setFilter: <K extends keyof DocumentUrlFilters>(
    key: K,
    value: DocumentUrlFilters[K]
  ) => void;
  setFilters: (updates: Partial<DocumentUrlFilters>) => void;
  setSearchInputValue: (value: string) => void;
  resetFilters: () => void;
  updateUrl: (
    updates: Partial<DocumentUrlFilters>,
    options?: { historyMode?: "push" | "replace"; scroll?: boolean }
  ) => void;
}

/**
 * Parses raw tab/type query parameter into a validated DocumentTabType
 */
export function parseDocumentTabType(val: string | null | undefined): DocumentTabType {
  if (!val) return "all";
  const normalized = val.trim().toLowerCase();
  if (normalized === "inbox" || normalized === "van_ban_den") return "inbox";
  if (normalized === "outbox" || normalized === "van_ban_di") return "outbox";
  if (normalized === "submission" || normalized === "pending" || normalized === "to_trinh_noi_bo") {
    return "submission";
  }
  if (normalized === "all" || normalized === "archive") return "all";
  return "all";
}

/**
 * Pure parser function converting URL search params to structured DocumentUrlFilters
 */
export function parseDocumentUrlFilters(
  searchParams?:
    | URLSearchParams
    | string
    | Record<string, string | string[] | undefined>
    | null,
  defaults: DocumentUrlFilters = DEFAULT_DOCUMENT_URL_FILTERS
): DocumentUrlFilters {
  let params: URLSearchParams;

  if (!searchParams) {
    params = new URLSearchParams();
  } else if (typeof searchParams === "string") {
    params = new URLSearchParams(searchParams);
  } else if (searchParams instanceof URLSearchParams) {
    params = searchParams;
  } else {
    params = new URLSearchParams();
    for (const [key, val] of Object.entries(searchParams)) {
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === "string") {
          params.set(key, val[0]);
        }
      } else if (typeof val === "string") {
        params.set(key, val);
      }
    }
  }

  // 1. type (with tab fallback)
  const rawType = params.get("type") ?? params.get("tab");
  const type = rawType ? parseDocumentTabType(rawType) : defaults.type;

  // 2. search (with q fallback)
  const rawSearch = params.get("search") ?? params.get("q");
  const search =
    rawSearch !== null && rawSearch !== undefined ? rawSearch.trim() : defaults.search;

  // 3. status
  const rawStatus = params.get("status");
  const status =
    rawStatus !== null && rawStatus !== undefined && rawStatus.trim() !== ""
      ? rawStatus.trim()
      : defaults.status;

  // 4. urgency
  const rawUrgency = params.get("urgency");
  const urgency =
    rawUrgency !== null && rawUrgency !== undefined && rawUrgency.trim() !== ""
      ? rawUrgency.trim()
      : defaults.urgency;

  // 5. leadUnitId (with dept fallback)
  const rawLeadUnitId = params.get("leadUnitId") ?? params.get("dept");
  const leadUnitId =
    rawLeadUnitId !== null && rawLeadUnitId !== undefined && rawLeadUnitId.trim() !== ""
      ? rawLeadUnitId.trim()
      : defaults.leadUnitId;

  // 6. documentYear (with year fallback)
  const rawYear = params.get("documentYear") ?? params.get("year");
  let documentYear: number | undefined = defaults.documentYear;
  if (rawYear) {
    const parsed = parseInt(rawYear, 10);
    if (!isNaN(parsed) && parsed >= 2000 && parsed <= 2100) {
      documentYear = parsed;
    }
  }

  // 7. page
  const rawPage = params.get("page");
  let page = defaults.page;
  if (rawPage) {
    const parsed = parseInt(rawPage, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      page = parsed;
    }
  }

  // 8. pageSize (with limit fallback)
  const rawPageSize = params.get("pageSize") ?? params.get("limit");
  let pageSize = defaults.pageSize;
  if (rawPageSize) {
    const parsed = parseInt(rawPageSize, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
      pageSize = parsed;
    }
  }

  return {
    type,
    search,
    status,
    urgency,
    leadUnitId,
    documentYear,
    page,
    pageSize,
  };
}

export interface SerializeDocumentUrlOptions {
  pathname?: string;
  existingParams?: URLSearchParams | string | null;
  preserveOtherParams?: boolean;
  defaults?: DocumentUrlFilters;
}

/**
 * Pure serializer function converting DocumentUrlFilters to canonical query string
 */
export function serializeDocumentUrlFilters(
  state: Partial<DocumentUrlFilters>,
  options: SerializeDocumentUrlOptions = {}
): string {
  const {
    pathname = "",
    existingParams,
    preserveOtherParams = true,
    defaults = DEFAULT_DOCUMENT_URL_FILTERS,
  } = options;

  let params: URLSearchParams;
  if (preserveOtherParams && existingParams) {
    params =
      typeof existingParams === "string"
        ? new URLSearchParams(existingParams)
        : new URLSearchParams(existingParams.toString());
  } else {
    params = new URLSearchParams();
  }

  // Clear legacy/alias params
  params.delete("tab");
  params.delete("q");
  params.delete("dept");
  params.delete("year");
  params.delete("limit");

  // 1. type
  if (state.type !== undefined) {
    if (state.type === "all" || state.type === defaults.type) {
      params.delete("type");
    } else {
      params.set("type", state.type);
    }
  }

  // 2. search
  if (state.search !== undefined) {
    const trimmed = state.search.trim();
    if (trimmed === "" || trimmed === defaults.search) {
      params.delete("search");
    } else {
      params.set("search", trimmed);
    }
  }

  // 3. status
  if (state.status !== undefined) {
    if (state.status === "ALL" || state.status === "" || state.status === defaults.status) {
      params.delete("status");
    } else {
      params.set("status", state.status);
    }
  }

  // 4. urgency
  if (state.urgency !== undefined) {
    if (state.urgency === "ALL" || state.urgency === "" || state.urgency === defaults.urgency) {
      params.delete("urgency");
    } else {
      params.set("urgency", state.urgency);
    }
  }

  // 5. leadUnitId
  if (state.leadUnitId !== undefined) {
    const trimmed = state.leadUnitId.trim();
    if (trimmed === "" || trimmed === "ALL" || trimmed === defaults.leadUnitId) {
      params.delete("leadUnitId");
    } else {
      params.set("leadUnitId", trimmed);
    }
  }

  // 6. documentYear
  if (state.documentYear !== undefined) {
    if (state.documentYear === defaults.documentYear || state.documentYear === null) {
      params.delete("documentYear");
    } else {
      params.set("documentYear", String(state.documentYear));
    }
  } else if ("documentYear" in state && state.documentYear === undefined) {
    params.delete("documentYear");
  }

  // 7. page
  if (state.page !== undefined) {
    if (state.page <= 1 || state.page === defaults.page) {
      params.delete("page");
    } else {
      params.set("page", String(state.page));
    }
  }

  // 8. pageSize
  if (state.pageSize !== undefined) {
    if (state.pageSize === defaults.pageSize) {
      params.delete("pageSize");
    } else {
      params.set("pageSize", String(state.pageSize));
    }
  }

  const qs = params.toString();
  if (!pathname) return qs ? `?${qs}` : "";
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Checks whether any non-default filter is currently active
 */
export function isDocumentFiltered(
  filters: DocumentUrlFilters,
  defaults: DocumentUrlFilters = DEFAULT_DOCUMENT_URL_FILTERS
): boolean {
  const isTypeFiltered = filters.type !== defaults.type;
  const isSearchFiltered = filters.search.trim() !== defaults.search.trim();
  const isStatusFiltered =
    filters.status !== defaults.status && filters.status !== "ALL" && filters.status !== "";
  const isUrgencyFiltered =
    filters.urgency !== defaults.urgency && filters.urgency !== "ALL" && filters.urgency !== "";
  const isLeadUnitFiltered =
    filters.leadUnitId.trim() !== defaults.leadUnitId.trim() &&
    filters.leadUnitId !== "ALL" &&
    filters.leadUnitId !== "";
  const isYearFiltered =
    filters.documentYear !== defaults.documentYear && filters.documentYear !== undefined;

  return (
    isTypeFiltered ||
    isSearchFiltered ||
    isStatusFiltered ||
    isUrgencyFiltered ||
    isLeadUnitFiltered ||
    isYearFiltered
  );
}

/**
 * Custom Hook for managing document filters synchronized with URL search params.
 * Includes 300ms search debounce, strict typing, startTransition navigation,
 * and comprehensive filter setters.
 */
export function useDocumentUrlFilters(
  options: UseDocumentUrlFiltersOptions = {}
): UseDocumentUrlFiltersReturn {
  const {
    defaultFilters,
    debounceMs = 300,
    resetPageOnFilterChange = true,
  } = options;

  const router = useRouter();
  const pathname = usePathname() || "";
  const rawSearchParams = useSearchParams();

  const searchParamsString = rawSearchParams?.toString() ?? "";

  const searchParams = React.useMemo(() => {
    return new URLSearchParams(searchParamsString);
  }, [searchParamsString]);

  const effectiveDefaults = React.useMemo<DocumentUrlFilters>(() => {
    return {
      ...DEFAULT_DOCUMENT_URL_FILTERS,
      ...defaultFilters,
    };
  }, [defaultFilters]);

  const filters = React.useMemo<DocumentUrlFilters>(() => {
    return parseDocumentUrlFilters(searchParams, effectiveDefaults);
  }, [searchParams, effectiveDefaults]);

  const [isPending, startTransition] = React.useTransition();

  // Local state for immediate typing responsiveness in search input
  const [searchInputValue, setSearchInputValueState] = React.useState<string>(filters.search);

  // Sync searchInputValue when URL filters.search changes externally (e.g. back/forward, resetFilters)
  React.useEffect(() => {
    setSearchInputValueState(filters.search);
  }, [filters.search]);

  const isFiltered = React.useMemo(() => {
    return isDocumentFiltered(filters, effectiveDefaults);
  }, [filters, effectiveDefaults]);

  // Core URL update dispatcher with startTransition for smooth UI
  const updateUrl = React.useCallback(
    (
      updates: Partial<DocumentUrlFilters>,
      navOptions: { historyMode?: "push" | "replace"; scroll?: boolean } = {}
    ) => {
      const { historyMode = "replace", scroll = false } = navOptions;

      const hasFilterChange =
        updates.type !== undefined ||
        updates.search !== undefined ||
        updates.status !== undefined ||
        updates.urgency !== undefined ||
        updates.leadUnitId !== undefined ||
        updates.documentYear !== undefined;

      const mergedUpdates: Partial<DocumentUrlFilters> = {
        ...updates,
        ...(resetPageOnFilterChange && hasFilterChange && updates.page === undefined
          ? { page: 1 }
          : {}),
      };

      const newUrl = serializeDocumentUrlFilters(mergedUpdates, {
        pathname: pathname || (typeof window !== "undefined" ? window.location.pathname : ""),
        existingParams: searchParams,
        preserveOtherParams: true,
        defaults: effectiveDefaults,
      });

      startTransition(() => {
        if (router) {
          if (historyMode === "push") {
            router.push(newUrl, { scroll });
          } else {
            router.replace(newUrl, { scroll });
          }
        } else if (typeof window !== "undefined") {
          if (historyMode === "push") {
            window.history.pushState(null, "", newUrl);
          } else {
            window.history.replaceState(null, "", newUrl);
          }
        }
      });
    },
    [router, pathname, searchParams, effectiveDefaults, resetPageOnFilterChange]
  );

  // Debounce search update to URL
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const setSearchInputValue = React.useCallback(
    (value: string) => {
      setSearchInputValueState(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        updateUrl({ search: value });
      }, debounceMs);
    },
    [updateUrl, debounceMs]
  );

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const setFilter = React.useCallback(
    <K extends keyof DocumentUrlFilters>(key: K, value: DocumentUrlFilters[K]) => {
      if (key === "search") {
        setSearchInputValue(value as string);
      } else {
        updateUrl({ [key]: value });
      }
    },
    [updateUrl, setSearchInputValue]
  );

  const setFilters = React.useCallback(
    (updates: Partial<DocumentUrlFilters>) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (updates.search !== undefined) {
        setSearchInputValueState(updates.search);
      }
      updateUrl(updates);
    },
    [updateUrl]
  );

  const resetFilters = React.useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchInputValueState(effectiveDefaults.search);
    updateUrl({
      type: effectiveDefaults.type,
      search: effectiveDefaults.search,
      status: effectiveDefaults.status,
      urgency: effectiveDefaults.urgency,
      leadUnitId: effectiveDefaults.leadUnitId,
      documentYear: effectiveDefaults.documentYear,
      page: 1,
      pageSize: effectiveDefaults.pageSize,
    });
  }, [updateUrl, effectiveDefaults]);

  return {
    filters,
    searchInputValue,
    isFiltered,
    isPending,
    setFilter,
    setFilters,
    setSearchInputValue,
    resetFilters,
    updateUrl,
  };
}
