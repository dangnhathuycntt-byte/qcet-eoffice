"use client";

import * as React from "react";
import type { AuthUser, UserRole } from "@/types/auth";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";
import {
  type TaskUrlParams,
  parseTaskUrlParams,
} from "@/hooks/use-task-filters";

// ============================================================================
// 1. Data Contracts & Interfaces
// ============================================================================

export type SavedViewRole = "EXECUTIVE" | "MANAGER" | "STAFF" | "ALL";

export interface TaskViewCriteria {
  scope: "school" | "unit" | "my";
  dept?: string;
  status?: string;
  workbox?: string;
  category?: string;
  priority?: string;
  academicMonth?: number | "ALL";
  q?: string;
  viewMode?: "table" | "kanban";
  density?: "compact" | "comfortable";
  sortField?: string;
  sortDirection?: "asc" | "desc";
}

export interface SavedTaskView {
  id: string;
  name: string;
  description?: string;
  isPreset: boolean;
  targetRole?: SavedViewRole;
  criteria: TaskViewCriteria;
  createdAt?: string; // ISO string
  updatedAt?: string; // ISO string
}

export interface TaskViewSerializedParams extends Record<string, string | undefined> {
  scope?: string;
  dept?: string;
  status?: string;
  workbox?: string;
  category?: string;
  priority?: string;
  month?: string;
  q?: string;
  view?: string;
  density?: string;
  sortField?: string;
  sortDirection?: string;
  viewId?: string;
}

// ============================================================================
// 2. Canonical Role Presets
// ============================================================================

/**
 * Executive Presets (Ban Giám Hiệu / Quản trị trường):
 * - Chờ BGH duyệt
 * - Trễ hạn toàn trường
 * - Nhiệm vụ trọng tâm
 */
export const EXECUTIVE_PRESETS: SavedTaskView[] = [
  {
    id: "exec-pending-approval",
    name: "Chờ BGH duyệt",
    description: "Nhiệm vụ cấp trường đang chờ Ban Giám hiệu phê duyệt kết quả",
    isPreset: true,
    targetRole: "EXECUTIVE",
    criteria: {
      scope: "school",
      status: "pending_review",
      workbox: "pending",
    },
  },
  {
    id: "exec-school-overdue",
    name: "Trễ hạn toàn trường",
    description: "Nhiệm vụ chậm tiến độ hoặc quá hạn trên phạm vi toàn trường",
    isPreset: true,
    targetRole: "EXECUTIVE",
    criteria: {
      scope: "school",
      status: "overdue",
      workbox: "overdue",
    },
  },
  {
    id: "exec-strategic-focus",
    name: "Nhiệm vụ trọng tâm",
    description: "Nhiệm vụ chiến lược trọng tâm và ưu tiên cao của nhà trường",
    isPreset: true,
    targetRole: "EXECUTIVE",
    criteria: {
      scope: "school",
      status: "all",
      priority: "HIGH",
    },
  },
];

/**
 * Manager Presets (Trưởng Khoa / Trưởng Phòng):
 * - Chờ tôi duyệt
 * - Việc đơn vị
 * - Quá hạn đơn vị
 */
export const MANAGER_PRESETS: SavedTaskView[] = [
  {
    id: "mgr-pending-approval",
    name: "Chờ tôi duyệt",
    description: "Báo cáo và nhiệm vụ trong đơn vị đang chờ trưởng đơn vị duyệt",
    isPreset: true,
    targetRole: "MANAGER",
    criteria: {
      scope: "unit",
      status: "pending_review",
      workbox: "pending",
    },
  },
  {
    id: "mgr-unit-tasks",
    name: "Việc đơn vị",
    description: "Toàn bộ nhiệm vụ công việc thuộc phạm vi quản lý của đơn vị",
    isPreset: true,
    targetRole: "MANAGER",
    criteria: {
      scope: "unit",
      status: "all",
    },
  },
  {
    id: "mgr-unit-overdue",
    name: "Quá hạn đơn vị",
    description: "Nhiệm vụ của đơn vị đang bị trễ hạn cần tập trung đôn đốc",
    isPreset: true,
    targetRole: "MANAGER",
    criteria: {
      scope: "unit",
      status: "overdue",
      workbox: "overdue",
    },
  },
];

/**
 * Staff Presets (Chuyên viên / Giảng viên):
 * - Việc của tôi
 * - Hạn tuần này
 */
export const STAFF_PRESETS: SavedTaskView[] = [
  {
    id: "staff-my-tasks",
    name: "Việc của tôi",
    description: "Nhiệm vụ cá nhân được phân công chủ trì hoặc phối hợp",
    isPreset: true,
    targetRole: "STAFF",
    criteria: {
      scope: "my",
      status: "my",
      workbox: "my_tasks",
    },
  },
  {
    id: "staff-this-week",
    name: "Hạn tuần này",
    description: "Nhiệm vụ cá nhân cần hoàn thành trong tuần này hoặc hôm nay",
    isPreset: true,
    targetRole: "STAFF",
    criteria: {
      scope: "my",
      status: "in_progress",
      workbox: "my_tasks",
    },
  },
];

export const ALL_ROLE_PRESETS: SavedTaskView[] = [
  ...EXECUTIVE_PRESETS,
  ...MANAGER_PRESETS,
  ...STAFF_PRESETS,
];

// ============================================================================
// 3. Pure Helper & Resolution Functions
// ============================================================================

/**
 * Resolves standard preset views for a given user or explicit role.
 */
export function resolveUserSavedViewRole(user?: AuthUser | null): SavedViewRole {
  if (!user) return "STAFF";
  if (isExecutiveUser(user) || user.role === "ADMIN") return "EXECUTIVE";
  if (isManagerUser(user) || user.role === "MANAGER") return "MANAGER";
  return "STAFF";
}

export function getRolePresetViews(
  roleOrUser?: SavedViewRole | UserRole | AuthUser | null,
  maybeUser?: AuthUser | null
): SavedTaskView[] {
  let role: SavedViewRole = "STAFF";

  if (typeof roleOrUser === "string") {
    const r = roleOrUser.toUpperCase();
    if (r === "EXECUTIVE" || r === "ADMIN") role = "EXECUTIVE";
    else if (r === "MANAGER") role = "MANAGER";
    else role = "STAFF";
  } else {
    const user = roleOrUser || maybeUser;
    role = resolveUserSavedViewRole(user);
  }

  switch (role) {
    case "EXECUTIVE":
      return [...EXECUTIVE_PRESETS];
    case "MANAGER":
      return [...MANAGER_PRESETS];
    case "STAFF":
    default:
      return [...STAFF_PRESETS];
  }
}

/**
 * Finds a preset by ID or alias.
 */
export function findPresetById(id?: string | null): SavedTaskView | undefined {
  if (!id) return undefined;
  const target = id.trim().toLowerCase();
  return ALL_ROLE_PRESETS.find((p) => {
    const pId = p.id.toLowerCase();
    if (pId === target) return true;
    if (pId.replace(/^preset-/, "") === target.replace(/^preset-/, "")) return true;
    if (pId.replace(/[-_]/g, "") === target.replace(/[-_]/g, "")) return true;
    if (
      (target.includes("exec") || target.includes("bgh")) &&
      (target.includes("pending") || target.includes("waiting")) &&
      (pId.includes("pending") || pId.includes("waiting")) &&
      (pId.includes("exec") || pId.includes("bgh"))
    ) {
      return true;
    }
    if (
      (target.includes("mgr") || target.includes("manager")) &&
      (target.includes("pending") || target.includes("waiting") || target.includes("me")) &&
      (pId.includes("pending") || pId.includes("waiting")) &&
      (pId.includes("mgr") || pId.includes("manager"))
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Strips decorative star glyphs from view names for clean presentation.
 */
export function cleanViewName(name?: string | null): string {
  if (!name) return "";
  return name.replace(/^[★*]\s*/, "").trim();
}

/**
 * Finds a preset by exact name or name with star removed.
 */
export function findPresetByName(name?: string | null): SavedTaskView | undefined {
  if (!name) return undefined;
  const norm = name.trim().toLowerCase();
  const exact = ALL_ROLE_PRESETS.find((p) => p.name.trim().toLowerCase() === norm);
  if (exact) return exact;

  const stripped = norm.replace(/^[★*]\s*/, "");
  return ALL_ROLE_PRESETS.find(
    (p) => p.name.trim().toLowerCase().replace(/^[★*]\s*/, "") === stripped
  );
}

/**
 * Robust comparison between two criteria objects.
 * Accurately treats undefined, empty string, and "ALL" / "all" as equivalent defaults.
 */
export function areCriteriaEqual(
  a?: TaskViewCriteria | null,
  b?: TaskViewCriteria | null
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  const normStr = (v?: string | null) => {
    if (!v) return "";
    const t = v.trim().toLowerCase();
    return t === "all" ? "" : t;
  };

  if (a.scope !== b.scope) return false;
  if (normStr(a.dept) !== normStr(b.dept)) return false;

  const normStatus = (s?: string | null) => {
    if (!s) return "";
    const lower = s.trim().toLowerCase();
    if (lower === "all") return "";
    if (lower === "waiting_approval" || lower === "pending_review" || lower === "pending") {
      return "pending_review";
    }
    return lower;
  };
  if (normStatus(a.status) !== normStatus(b.status)) return false;

  if (normStr(a.workbox) !== normStr(b.workbox)) return false;
  if (normStr(a.category) !== normStr(b.category)) return false;
  if (normStr(a.priority) !== normStr(b.priority)) return false;

  const aMonth = a.academicMonth === undefined || a.academicMonth === "ALL" ? "ALL" : Number(a.academicMonth);
  const bMonth = b.academicMonth === undefined || b.academicMonth === "ALL" ? "ALL" : Number(b.academicMonth);
  if (aMonth !== bMonth) return false;

  if ((a.q || "").trim() !== (b.q || "").trim()) return false;
  if ((a.viewMode || "table") !== (b.viewMode || "table")) return false;

  return true;
}

/**
 * Pure mapping from criteria to TaskViewSerializedParams.
 */
export function criteriaToUrlParams(
  criteria: TaskViewCriteria,
  viewId?: string
): TaskViewSerializedParams {
  const params: TaskViewSerializedParams = {};

  if (criteria.scope) params.scope = criteria.scope;
  if (criteria.dept && criteria.dept !== "ALL") params.dept = criteria.dept;
  if (criteria.status && criteria.status !== "all" && criteria.status !== "ALL") {
    params.status = criteria.status;
  }
  if (criteria.workbox && criteria.workbox !== "all" && criteria.workbox !== "ALL") {
    params.workbox = criteria.workbox;
  }
  if (criteria.academicMonth !== undefined && criteria.academicMonth !== "ALL") {
    params.month = String(criteria.academicMonth);
  }
  if (criteria.category && criteria.category !== "ALL") {
    params.category = criteria.category;
  }
  if (criteria.priority && criteria.priority !== "ALL") {
    params.priority = criteria.priority;
  }
  if (criteria.q && criteria.q.trim() !== "") {
    params.q = criteria.q.trim();
  }
  if (criteria.viewMode && criteria.viewMode !== "table") {
    params.view = criteria.viewMode;
  }
  if (criteria.density && criteria.density !== "comfortable") {
    params.density = criteria.density;
  }
  if (criteria.sortField) {
    params.sortField = criteria.sortField;
  }
  if (criteria.sortDirection) {
    params.sortDirection = criteria.sortDirection;
  }
  if (viewId && viewId.trim() !== "") {
    params.viewId = viewId.trim();
  }

  return params;
}

/**
 * Pure mapping from TaskUrlParams or search string to criteria and optional viewId.
 */
export function urlParamsToCriteria(
  input?: TaskUrlParams | URLSearchParams | string | null
): { criteria: TaskViewCriteria; viewId?: string } {
  let parsed: TaskUrlParams = {};
  let rawViewId: string | undefined;
  let rawDensity: string | null = null;
  let rawPriority: string | null = null;
  let rawCategory: string | null = null;

  if (typeof input === "string" || (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams)) {
    const searchString = typeof input === "string" ? input.replace(/^\?/, "") : input.toString();
    const sp = new URLSearchParams(searchString);
    parsed = parseTaskUrlParams(sp);
    rawViewId = sp.get("viewId") || sp.get("view_id") || sp.get("savedView") || undefined;
    rawDensity = sp.get("density");
    rawPriority = sp.get("priority");
    rawCategory = sp.get("category");
  } else if (input) {
    parsed = input as TaskUrlParams;
    rawViewId = (input as any).viewId;
  } else {
    parsed = parseTaskUrlParams();
  }

  const criteria: TaskViewCriteria = {
    scope: parsed.scope || "my",
    dept: parsed.dept || "ALL",
    status: parsed.status || "all",
    workbox: parsed.workbox || "ALL",
    academicMonth: parsed.month || "ALL",
    q: parsed.q || "",
    viewMode: parsed.view || "table",
  };

  if (rawDensity === "compact" || rawDensity === "comfortable") {
    criteria.density = rawDensity;
  }
  if (rawPriority && rawPriority !== "ALL") {
    criteria.priority = rawPriority;
  }
  if (rawCategory && rawCategory !== "ALL") {
    criteria.category = rawCategory;
  }

  return { criteria, viewId: rawViewId || parsed.viewId };
}

// ============================================================================
// 4. Browser Storage Persistence (localStorage with graceful SSR Fallback)
// ============================================================================

const STORAGE_KEY_PREFIX = "qcet_saved_task_views_v1";

// In-memory fallback map for non-browser environments (SSR/Tests)
const memoryStorageMap = new Map<string, string>();

const memoryStorageFallback: Storage = {
  getItem: (key: string) => memoryStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryStorageMap.set(key, String(value));
  },
  removeItem: (key: string) => {
    memoryStorageMap.delete(key);
  },
  clear: () => {
    memoryStorageMap.clear();
  },
  key: (index: number) => Array.from(memoryStorageMap.keys())[index] ?? null,
  get length() {
    return memoryStorageMap.size;
  },
};

function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {
    // Storage access blocked or restricted
  }
  return memoryStorageFallback;
}

function getStorageKey(userId?: string): string {
  if (userId && userId.trim() !== "" && userId !== "guest") {
    return `${STORAGE_KEY_PREFIX}_${userId.trim()}`;
  }
  return STORAGE_KEY_PREFIX;
}

/**
 * Safely reads custom views from localStorage.
 * Guaranteed not to throw during SSR or if storage is blocked/corrupted.
 */
export function getCustomSavedViews(userId?: string): SavedTaskView[] {
  const storage = getLocalStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        item.criteria &&
        typeof item.criteria === "object"
    );
  } catch {
    return [];
  }
}

/**
 * Saves a new custom view into localStorage.
 * Overloaded to support both (name, criteria, userId) and (viewData, userId).
 */
export function saveCustomView(
  nameOrData: string | Omit<SavedTaskView, "id" | "isPreset" | "createdAt" | "updatedAt">,
  criteriaOrUserId?: TaskViewCriteria | string,
  userId?: string
): SavedTaskView {
  const now = new Date().toISOString();
  let name = "";
  let description: string | undefined;
  let criteria: TaskViewCriteria = { scope: "my" };
  let effectiveUserId = userId;

  if (typeof nameOrData === "string") {
    name = nameOrData.trim();
    if (typeof criteriaOrUserId === "object" && criteriaOrUserId !== null) {
      criteria = { ...criteriaOrUserId };
    }
  } else {
    name = nameOrData.name.trim();
    description = nameOrData.description?.trim();
    criteria = { ...nameOrData.criteria };
    if (typeof criteriaOrUserId === "string") {
      effectiveUserId = criteriaOrUserId;
    }
  }

  const newView: SavedTaskView = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name || "Chế độ xem tùy chỉnh",
    description,
    isPreset: false,
    criteria,
    createdAt: now,
    updatedAt: now,
  };

  const storage = getLocalStorage();
  if (!storage) return newView;

  try {
    const existing = getCustomSavedViews(effectiveUserId);
    const updated = [newView, ...existing];
    storage.setItem(getStorageKey(effectiveUserId), JSON.stringify(updated));
  } catch {
    // Quota or access error handled gracefully
  }

  return newView;
}

/**
 * Updates an existing custom view (rename, update description or criteria).
 */
export function updateCustomView(
  id: string,
  updates: Partial<Pick<SavedTaskView, "name" | "description" | "criteria">>,
  userId?: string
): SavedTaskView | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    const existing = getCustomSavedViews(userId);
    const index = existing.findIndex((v) => v.id === id);
    if (index === -1) return null;

    const target = existing[index];
    const updatedView: SavedTaskView = {
      ...target,
      ...(updates.name ? { name: updates.name.trim() } : {}),
      ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
      ...(updates.criteria ? { criteria: { ...updates.criteria } } : {}),
      updatedAt: new Date().toISOString(),
    };

    existing[index] = updatedView;
    storage.setItem(getStorageKey(userId), JSON.stringify(existing));
    return updatedView;
  } catch {
    return null;
  }
}

/**
 * Deletes a custom view by ID.
 */
export function deleteCustomView(id: string, userId?: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;

  try {
    const existing = getCustomSavedViews(userId);
    const filtered = existing.filter((v) => v.id !== id);
    if (filtered.length === existing.length) return false;

    storage.setItem(getStorageKey(userId), JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears all custom views for the user.
 */
export function clearCustomViews(userId?: string): void {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.removeItem(getStorageKey(userId));
  } catch {
    // Graceful fallback
  }
}

// ============================================================================
// 5. State Hook: useSavedViews
// ============================================================================

export interface UseSavedViewsOptions {
  user?: AuthUser | null;
  currentCriteria?: TaskViewCriteria;
  onApplyView?: (view: SavedTaskView) => void;
  initialViewId?: string;
}

export interface UseSavedViewsReturn {
  presetViews: SavedTaskView[];
  customViews: SavedTaskView[];
  allViews: SavedTaskView[];
  activeViewId: string | null;
  activeView: SavedTaskView | null;
  isCurrentCriteriaMatching: boolean;
  saveCurrentView: (name: string, description?: string) => SavedTaskView;
  renameView: (id: string, newName: string) => SavedTaskView | null;
  deleteView: (id: string) => boolean;
  applyView: (view: SavedTaskView) => void;
  setActiveViewId: (id: string | null) => void;
}

export function useSavedViews({
  user,
  currentCriteria,
  onApplyView,
  initialViewId,
}: UseSavedViewsOptions = {}): UseSavedViewsReturn {
  const [customViews, setCustomViews] = React.useState<SavedTaskView[]>([]);
  const [activeViewId, setActiveViewId] = React.useState<string | null>(initialViewId || null);

  // Load custom views on mount or user change
  React.useEffect(() => {
    setCustomViews(getCustomSavedViews(user?.id));
  }, [user?.id]);

  const presetViews = React.useMemo(() => {
    return getRolePresetViews(user);
  }, [user]);

  const allViews = React.useMemo(() => {
    return [...presetViews, ...customViews];
  }, [presetViews, customViews]);

  // Find active view instance
  const activeView = React.useMemo(() => {
    if (!activeViewId) return null;
    return allViews.find((v) => v.id === activeViewId) || null;
  }, [activeViewId, allViews]);

  // Check if current filter criteria match the active view
  const isCurrentCriteriaMatching = React.useMemo(() => {
    if (!activeView || !currentCriteria) return false;
    return areCriteriaEqual(activeView.criteria, currentCriteria);
  }, [activeView, currentCriteria]);

  const saveCurrentView = React.useCallback(
    (name: string, description?: string) => {
      const criteriaToSave: TaskViewCriteria = currentCriteria
        ? { ...currentCriteria }
        : { scope: "my" };
      const newView = saveCustomView(
        {
          name,
          description,
          criteria: criteriaToSave,
        },
        user?.id
      );
      setCustomViews((prev) => [newView, ...prev]);
      setActiveViewId(newView.id);
      return newView;
    },
    [currentCriteria, user?.id]
  );

  const renameView = React.useCallback(
    (id: string, newName: string) => {
      const updated = updateCustomView(id, { name: newName }, user?.id);
      if (updated) {
        setCustomViews((prev) => prev.map((v) => (v.id === id ? updated : v)));
      }
      return updated;
    },
    [user?.id]
  );

  const deleteView = React.useCallback(
    (id: string) => {
      const ok = deleteCustomView(id, user?.id);
      if (ok) {
        setCustomViews((prev) => prev.filter((v) => v.id !== id));
        if (activeViewId === id) {
          setActiveViewId(null);
        }
      }
      return ok;
    },
    [activeViewId, user?.id]
  );

  const applyView = React.useCallback(
    (view: SavedTaskView) => {
      setActiveViewId(view.id);
      onApplyView?.(view);
    },
    [onApplyView]
  );

  return {
    presetViews,
    customViews,
    allViews,
    activeViewId,
    activeView,
    isCurrentCriteriaMatching,
    saveCurrentView,
    renameView,
    deleteView,
    applyView,
    setActiveViewId,
  };
}
