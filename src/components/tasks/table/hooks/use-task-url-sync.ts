"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type {
  TableDensity,
  SmartFilterTab,
  TaskViewMode,
} from "../types";
import type { TaskCategory } from "@/types/dashboard";

/**
 * Trạng thái URL của bảng quản lý công việc
 */
export interface TaskUrlState {
  view: TaskViewMode;
  tab: SmartFilterTab;
  dept: string;
  category: TaskCategory | "ALL";
  month: number | "ALL";
  q: string;
  page: number;
  density: TableDensity;
  taskId: string | null;
}

/**
 * Giá trị URL mặc định chuẩn
 */
export const DEFAULT_TASK_URL_STATE: TaskUrlState = {
  view: "table",
  tab: "all",
  dept: "ALL",
  category: "ALL",
  month: "ALL",
  q: "",
  page: 1,
  density: "comfortable",
  taskId: null,
};

const VALID_VIEWS: TaskViewMode[] = ["table", "kanban", "gantt"];
const VALID_TABS: SmartFilterTab[] = [
  "all",
  "my_tasks",
  "overdue",
  "review",
  "today",
  "in_progress",
  "completed",
];
const VALID_CATEGORIES: (TaskCategory | "ALL")[] = [
  "ALL",
  "CHUYEN_DOI_SO",
  "TRUYEN_THONG",
  "CNTT",
  "ATTT",
  "THU_VIEN",
  "BAO_CAO",
  "KHAC",
];
const VALID_DENSITIES: TableDensity[] = ["compact", "comfortable"];

/**
 * Hàm phân tích thuần túy (Pure Parser) từ URL query params sang TaskUrlState
 */
export function parseTaskUrlParams(
  searchParams?:
    | URLSearchParams
    | string
    | Record<string, string | string[] | undefined>
    | null,
  defaults: TaskUrlState = DEFAULT_TASK_URL_STATE
): TaskUrlState {
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

  // 1. view
  const rawView = params.get("view");
  const view: TaskViewMode =
    rawView && (VALID_VIEWS as string[]).includes(rawView)
      ? (rawView as TaskViewMode)
      : defaults.view;

  // 2. tab
  const rawTab = params.get("tab");
  const tab: SmartFilterTab =
    rawTab && (VALID_TABS as string[]).includes(rawTab)
      ? (rawTab as SmartFilterTab)
      : defaults.tab;

  // 3. dept
  const rawDept = params.get("dept");
  const dept =
    rawDept && rawDept.trim() !== "" ? rawDept.trim() : defaults.dept;

  // 4. category
  const rawCategory = params.get("category");
  const normalizedCategory =
    rawCategory === "OTHER" ? "KHAC" : rawCategory;
  const category: TaskCategory | "ALL" =
    normalizedCategory &&
    (VALID_CATEGORIES as string[]).includes(normalizedCategory)
      ? (normalizedCategory as TaskCategory | "ALL")
      : defaults.category;

  // 5. q (search)
  const rawQ = params.get("q");
  const q = rawQ !== null ? rawQ.trim() : defaults.q;

  // 6. month
  const rawMonth = params.get("month");
  let month: number | "ALL" = defaults.month;
  if (rawMonth === "ALL") {
    month = "ALL";
  } else if (rawMonth) {
    const parsed = parseInt(rawMonth, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
      month = parsed;
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

  // 8. density
  const rawDensity = params.get("density");
  const density: TableDensity =
    rawDensity && (VALID_DENSITIES as string[]).includes(rawDensity)
      ? (rawDensity as TableDensity)
      : defaults.density;

  // 9. taskId
  const rawTaskId = params.get("taskId");
  const taskId =
    rawTaskId && rawTaskId.trim() !== "" ? rawTaskId.trim() : defaults.taskId;

  return {
    view,
    tab,
    dept,
    category,
    month,
    q,
    page,
    density,
    taskId,
  };
}

/**
 * Cấu hình tùy chọn tuần tự hóa URL
 */
export interface SerializeUrlOptions {
  pathname?: string;
  existingParams?: URLSearchParams | string | null;
  preserveOtherParams?: boolean;
}

/**
 * Hàm tuần tự hóa thuần túy (Pure Serializer) từ TaskUrlState sang chuỗi query URL canonical
 */
export function serializeTaskUrlParams(
  state: Partial<TaskUrlState>,
  options: SerializeUrlOptions = {}
): string {
  const { pathname = "", existingParams, preserveOtherParams = true } = options;

  let params: URLSearchParams;
  if (preserveOtherParams && existingParams) {
    params =
      typeof existingParams === "string"
        ? new URLSearchParams(existingParams)
        : new URLSearchParams(existingParams.toString());
  } else {
    params = new URLSearchParams();
  }

  // 1. view (omit default "table")
  if (state.view !== undefined) {
    if (state.view === "table" || !state.view) {
      params.delete("view");
    } else {
      params.set("view", state.view);
    }
  }

  // 2. tab (omit default "all")
  if (state.tab !== undefined) {
    if (state.tab === "all" || !state.tab) {
      params.delete("tab");
    } else {
      params.set("tab", state.tab);
    }
  }

  // 3. dept (omit default "ALL")
  if (state.dept !== undefined) {
    if (state.dept === "ALL" || !state.dept.trim()) {
      params.delete("dept");
    } else {
      params.set("dept", state.dept.trim());
    }
  }

  // 4. category (omit default "ALL")
  if (state.category !== undefined) {
    if (state.category === "ALL" || !state.category) {
      params.delete("category");
    } else {
      params.set("category", state.category);
    }
  }

  // 4.1 month (omit default "ALL")
  if (state.month !== undefined) {
    if (state.month === "ALL" || !state.month) {
      params.delete("month");
    } else {
      params.set("month", String(state.month));
    }
  }

  // 5. q (omit empty)
  if (state.q !== undefined) {
    if (!state.q || !state.q.trim()) {
      params.delete("q");
    } else {
      params.set("q", state.q.trim());
    }
  }

  // 6. page (omit 1 or less)
  if (state.page !== undefined) {
    if (state.page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(Math.floor(state.page)));
    }
  }

  // 7. density (omit default "comfortable")
  if (state.density !== undefined) {
    if (state.density === "comfortable" || !state.density) {
      params.delete("density");
    } else {
      params.set("density", state.density);
    }
  }

  // 8. taskId (omit empty/null)
  if (state.taskId !== undefined) {
    if (!state.taskId || !state.taskId.trim()) {
      params.delete("taskId");
    } else {
      params.set("taskId", state.taskId.trim());
    }
  }

  const qs = params.toString();
  if (!pathname) return qs;
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Xây dựng URL hoàn chỉnh kết hợp path hiện tại và cập nhật params
 */
export function buildTaskUrl(
  updates: Partial<TaskUrlState>,
  existingParams?: URLSearchParams | string | null,
  pathname?: string
): string {
  return serializeTaskUrlParams(updates, {
    pathname: pathname ?? "",
    existingParams,
    preserveOtherParams: true,
  });
}

/**
 * Kiểu trả về cho hook useTaskUrlSync
 */
export interface UseTaskUrlSyncReturn {
  urlState: TaskUrlState;
  setView: (view: TaskViewMode) => void;
  setTab: (tab: SmartFilterTab) => void;
  setDept: (dept: string) => void;
  setCategory: (category: TaskCategory | "ALL") => void;
  setMonth: (month: number | "ALL") => void;
  setSearch: (q: string) => void;
  setPage: (page: number) => void;
  setDensity: (density: TableDensity) => void;
  setTaskId: (taskId: string | null) => void;
  updateUrlParams: (
    updates: Partial<TaskUrlState>,
    options?: { scroll?: boolean }
  ) => void;
  resetFilters: () => void;
  clearAll: () => void;
}

/**
 * Hook đồng bộ 2 chiều URL query params với bảng nhiệm vụ trong Next.js App Router
 */
export function useTaskUrlSync(
  initialDefaults?: Partial<TaskUrlState>
): UseTaskUrlSyncReturn {
  let router: ReturnType<typeof useRouter> | null = null;
  let pathname: string = "";
  let rawSearchParams: ReturnType<typeof useSearchParams> | null = null;

  try {
    // Next.js App Router hooks
    router = useRouter();
    pathname = usePathname() || "";
    rawSearchParams = useSearchParams();
  } catch {
    // Graceful fallback for non-App-Router or test environments
    rawSearchParams = null;
  }

  const searchParamsString = rawSearchParams?.toString() ?? "";

  const searchParams = React.useMemo(() => {
    return new URLSearchParams(searchParamsString);
  }, [searchParamsString]);

  const effectiveDefaults = React.useMemo<TaskUrlState>(() => {
    return {
      ...DEFAULT_TASK_URL_STATE,
      ...initialDefaults,
    };
  }, [initialDefaults]);

  // Phân tích trạng thái hiện thời từ URLSearchParams (chỉ re-evaluate khi searchParamsString hoặc defaults thay đổi)
  const urlState = React.useMemo<TaskUrlState>(() => {
    return parseTaskUrlParams(searchParams, effectiveDefaults);
  }, [searchParams, effectiveDefaults]);

  // Điều phối cập nhật URL query params
  const updateUrlParams = React.useCallback(
    (
      updates: Partial<TaskUrlState>,
      options: { scroll?: boolean } = { scroll: false }
    ) => {
      // Khi thay đổi bộ lọc (tab, dept, category, q), tự động reset page về 1 nếu không chỉ định page
      const hasFilterChange =
        updates.tab !== undefined ||
        updates.dept !== undefined ||
        updates.category !== undefined ||
        updates.month !== undefined ||
        updates.q !== undefined;

      const mergedUpdates: Partial<TaskUrlState> = {
        ...updates,
        ...(hasFilterChange && updates.page === undefined ? { page: 1 } : {}),
      };

      const newUrl = serializeTaskUrlParams(mergedUpdates, {
        pathname: pathname || (typeof window !== "undefined" ? window.location.pathname : ""),
        existingParams: searchParams,
        preserveOtherParams: true,
      });

      if (router) {
        router.replace(newUrl, { scroll: options.scroll ?? false });
      } else if (typeof window !== "undefined") {
        window.history.replaceState(null, "", newUrl);
      }
    },
    [router, pathname, searchParams]
  );

  const setView = React.useCallback(
    (view: TaskViewMode) => updateUrlParams({ view }),
    [updateUrlParams]
  );

  const setTab = React.useCallback(
    (tab: SmartFilterTab) => updateUrlParams({ tab }),
    [updateUrlParams]
  );

  const setDept = React.useCallback(
    (dept: string) => updateUrlParams({ dept }),
    [updateUrlParams]
  );

  const setCategory = React.useCallback(
    (category: TaskCategory | "ALL") => updateUrlParams({ category }),
    [updateUrlParams]
  );

  const setMonth = React.useCallback(
    (month: number | "ALL") => updateUrlParams({ month }),
    [updateUrlParams]
  );

  const setSearch = React.useCallback(
    (q: string) => updateUrlParams({ q }),
    [updateUrlParams]
  );

  const setPage = React.useCallback(
    (page: number) => updateUrlParams({ page }),
    [updateUrlParams]
  );

  const setDensity = React.useCallback(
    (density: TableDensity) => updateUrlParams({ density }),
    [updateUrlParams]
  );

  const setTaskId = React.useCallback(
    (taskId: string | null) => updateUrlParams({ taskId }),
    [updateUrlParams]
  );

  const resetFilters = React.useCallback(() => {
    updateUrlParams({
      tab: effectiveDefaults.tab,
      dept: effectiveDefaults.dept,
      category: effectiveDefaults.category,
      month: effectiveDefaults.month,
      q: effectiveDefaults.q,
      page: 1,
    });
  }, [updateUrlParams, effectiveDefaults]);

  const clearAll = React.useCallback(() => {
    updateUrlParams({
      view: effectiveDefaults.view,
      tab: effectiveDefaults.tab,
      dept: effectiveDefaults.dept,
      category: effectiveDefaults.category,
      month: effectiveDefaults.month,
      q: effectiveDefaults.q,
      page: 1,
      density: effectiveDefaults.density,
      taskId: null,
    });
  }, [updateUrlParams, effectiveDefaults]);

  return {
    urlState,
    setView,
    setTab,
    setDept,
    setCategory,
    setMonth,
    setSearch,
    setPage,
    setDensity,
    setTaskId,
    updateUrlParams,
    resetFilters,
    clearAll,
  };
}
