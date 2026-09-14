"use client";

import * as React from "react";
import {
  ChevronDown,
  RotateCcw,
  X,
} from "lucide-react";
import type {
  SchoolTask,
  StaffTask,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import { useAuth } from "@/lib/auth-context";
import { canAssignUnitTask, matchesUser } from "@/lib/role-task-filter";
import { useDisplayDensity } from "@/components/density-provider";
import {
  getAcademicMonthPeriod,
  getSystemReferenceDate,
  filterTasksByAcademicMonthStrict,
} from "@/lib/academic-calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { DashboardModalContext } from "@/components/dashboard/dashboard-context";

import type {
  SmartFilterTab,
  TableDensity,
  TaskSortField,
  SortDirection,
} from "./types";
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_DENSITY,
} from "./constants";
import {
  filterTasks,
  paginateTasks,
} from "./utils/table-filter-engine";
import { formatTableDate } from "./utils/table-date-helpers";
import { sortTasks } from "./utils/table-sorters";
import { useTaskTableState } from "./hooks/use-task-table-state";
import { useTaskUrlSync } from "./hooks/use-task-url-sync";
import { useTaskKeyboardNav } from "./hooks/use-task-keyboard-nav";

import { TaskTableHeader } from "./components/task-table-header";
import { TaskRow } from "./components/task-row";
import { SubtaskRowGroup } from "./components/subtask-row-group";
import { TaskPaginationBar } from "./components/task-pagination-bar";
import { TaskEmptyState } from "./components/task-empty-state";
import { MobileTaskCard } from "./components/mobile-task-card";
import {
  TaskTableToolbar,
  aggregateFilterCounts,
} from "./components/task-table-toolbar";
import { BatchActionBar, TaskBulkActionBar } from "./components/batch-action-bar";
import {
  filterBulkTransitionTargets,
} from "@/domain/tasks/bulk-lifecycle-capability";
import type {
  TaskActorContract,
  TaskEntityContract,
} from "@/domain/tasks/contract";

/** Lifecycle targets the bulk bar may offer, before capability filtering. */
const BULK_LIFECYCLE_CANDIDATES: TaskStatus[] = [
  "IN_PROGRESS",
  "WAITING_APPROVAL",
  "NEEDS_REVIEW",
  "COMPLETED",
  "CANCELLED",
];

export interface ModularCascadingTaskTableProps {
  tasks: SchoolTask[];
  scope?: string;
  defaultExpanded?: boolean;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onAddTask?: () => void;
  onStatusChange?: (
    taskId: string,
    newStatus: TaskStatus,
    ...rest: any[]
  ) => Promise<void> | void;
  onUrge?: (
    taskId: string,
    taskTitle: string,
    assigneeName: string
  ) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  className?: string;
  hideWorkbox?: boolean;
  hideToolbar?: boolean;
  onOpenSubmitModal?: (task: StaffTask) => void;
  onAddSubTask?: (parentTaskOrId: SchoolTask | string) => void;
  selectedAcademicMonth?: number | "ALL";
  onAcademicMonthChange?: (month: number | "ALL") => void;
  selectedMonth?: number | "ALL";
  onMonthChange?: (month: number | "ALL") => void;
  priorOverdueBacklog?: SchoolTask[];
  canAssign?: boolean;
  initialTab?: SmartFilterTab;
  initialDepartment?: string;
  initialCategory?: TaskCategory | "ALL";
  initialDensity?: TableDensity;
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
  initialPageSize?: number;
  syncWithUrl?: boolean;
  referenceDate?: string | Date;
  onBulkStatusChange?: (status: TaskStatus) => Promise<void> | void;
  onBulkExtendDeadline?: (newDueDate: string) => Promise<void> | void;
  onBulkReassign?: (newAssigneeId: string) => Promise<void> | void;
  onBulkDelete?: (taskIds: string[]) => Promise<void> | void;
  onExportExcel?: () => void;
  selectedTaskId?: string;
}

function TableShortcutHelpTrigger() {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Xem danh sách phím tắt (? Phím tắt)"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border/70 bg-background hover:bg-muted/60 transition-colors cursor-pointer select-none shadow-2xs"
      >
        <span className="inline-flex items-center justify-center font-mono font-bold text-xs bg-muted/60 rounded px-1 text-foreground">
          ?
        </span>
        <span className="font-medium">Phím tắt</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Phím tắt nhanh: Hướng dẫn thao tác bàn phím"
          className="absolute bottom-full right-0 mb-2 w-72 rounded-2xl border border-border/80 bg-card p-3 shadow-lg z-50 text-xs text-foreground animate-in fade-in-0 zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60 mb-2">
            <span className="font-semibold text-foreground">Phím tắt nhanh:</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted min-h-[28px] min-w-[28px] flex items-center justify-center cursor-pointer"
              aria-label="Đóng bảng phím tắt"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span>Tìm kiếm</span>
              <kbd className="px-1.5 py-0.5 font-mono text-xs bg-muted/60 rounded border border-border text-foreground font-semibold shadow-2xs">
                /
              </kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Di chuyển dòng</span>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 font-mono text-xs bg-muted/60 rounded border border-border text-foreground font-semibold shadow-2xs">
                  J
                </kbd>
                <kbd className="px-1.5 py-0.5 font-mono text-xs bg-muted/60 rounded border border-border text-foreground font-semibold shadow-2xs">
                  K
                </kbd>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>Xem chi tiết</span>
              <kbd className="px-1.5 py-0.5 font-mono text-xs bg-muted/60 rounded border border-border text-foreground font-semibold shadow-2xs">
                ↵
              </kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Chọn dòng</span>
              <kbd className="px-1.5 py-0.5 font-mono text-xs bg-muted/60 rounded border border-border text-foreground font-semibold shadow-2xs">
                X
              </kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Đóng / Hủy chọn</span>
              <kbd className="px-1.5 py-0.5 font-mono text-xs bg-muted/60 rounded border border-border text-foreground font-semibold shadow-2xs">
                Esc
              </kbd>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-muted-foreground">
              <span>Menu lệnh toàn cục</span>
              <kbd className="px-1.5 py-0.5 font-mono text-xs bg-muted/60 rounded border border-border text-foreground font-semibold shadow-2xs">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ModularCascadingTaskTable({
  tasks = [],
  scope,
  defaultExpanded,
  onSelectTask,
  onAddTask,
  onStatusChange,
  onUrge,
  onRefresh,
  className,
  hideWorkbox = false,
  hideToolbar = false,
  onOpenSubmitModal,
  onAddSubTask,
  selectedAcademicMonth,
  onAcademicMonthChange,
  selectedMonth,
  onMonthChange,
  priorOverdueBacklog = [],
  canAssign,
  initialTab = "all",
  initialDepartment = "ALL",
  initialCategory = "ALL",
  initialDensity,
  density: propDensity,
  onDensityChange: propOnDensityChange,
  initialPageSize = DEFAULT_PAGE_SIZE,
  syncWithUrl = false,
  referenceDate = getSystemReferenceDate(),
  onBulkStatusChange,
  onBulkExtendDeadline,
  onBulkReassign,
  onBulkDelete,
  onExportExcel,
  selectedTaskId,
}: ModularCascadingTaskTableProps) {
  // 1. Context & User Resolution
  let user: ReturnType<typeof useAuth>["user"] = null;
  try {
    const auth = useAuth();
    user = auth?.user ?? null;
  } catch {
    user = null;
  }

  let contextDensity: TableDensity | undefined = undefined;
  try {
    const densityCtx = useDisplayDensity();
    if (densityCtx?.density) {
      contextDensity = densityCtx.density;
    }
  } catch {
    contextDensity = undefined;
  }

  const effectiveInitialDensity =
    initialDensity ?? contextDensity ?? DEFAULT_DENSITY;
  const canAssignUnit = canAssign ?? (user ? canAssignUnitTask(user) : true);

  let dashboardModal: any = null;
  try {
    dashboardModal = React.useContext(DashboardModalContext);
  } catch {
    dashboardModal = null;
  }

  const effectiveOnAddSubTask = React.useMemo(() => {
    if (onAddSubTask) {
      return (parentTaskOrId: SchoolTask | string) => {
        const parentId =
          typeof parentTaskOrId === "string" ? parentTaskOrId : parentTaskOrId.id;
        (onAddSubTask as (id: string) => void)(parentId);
      };
    }
    if (dashboardModal?.openCreateModal) {
      return (parentTaskOrId: SchoolTask | string) => {
        const parentId =
          typeof parentTaskOrId === "string" ? parentTaskOrId : parentTaskOrId.id;
        dashboardModal.openCreateModal("DON_VI", parentId);
      };
    }
    return undefined;
  }, [onAddSubTask, dashboardModal]);

  const effectiveMonthInput =
    selectedMonth !== undefined ? selectedMonth : selectedAcademicMonth;
  const effectiveOnMonthChange = onMonthChange || onAcademicMonthChange;

  // 2. URL Sync (if enabled)
  const urlSync = useTaskUrlSync({
    tab: initialTab,
    dept: initialDepartment,
    category: initialCategory,
    month: effectiveMonthInput ?? "ALL",
    density: effectiveInitialDensity,
    page: 1,
  });

  // 3. Filter States (sync with URL if syncWithUrl === true)
  const [localSearch, setLocalSearch] = React.useState<string>(
    syncWithUrl ? urlSync.urlState.q : ""
  );
  const [localTab, setLocalTab] = React.useState<SmartFilterTab>(
    syncWithUrl ? urlSync.urlState.tab : initialTab
  );
  const [localDept, setLocalDept] = React.useState<string>(
    syncWithUrl ? urlSync.urlState.dept : initialDepartment
  );
  const [localCategory, setLocalCategory] = React.useState<TaskCategory | "ALL">(
    syncWithUrl ? urlSync.urlState.category : initialCategory
  );
  const [localMonth, setLocalMonth] = React.useState<number | "ALL">(
    effectiveMonthInput !== undefined
      ? effectiveMonthInput
      : syncWithUrl
      ? urlSync.urlState.month
      : "ALL"
  );

  React.useEffect(() => {
    if (effectiveMonthInput !== undefined) {
      setLocalMonth(effectiveMonthInput);
    }
  }, [effectiveMonthInput]);

  const activeSearch = syncWithUrl ? urlSync.urlState.q : localSearch;
  const activeTab = syncWithUrl ? urlSync.urlState.tab : localTab;
  const activeDept = syncWithUrl ? urlSync.urlState.dept : localDept;
  const activeCategory = syncWithUrl ? urlSync.urlState.category : localCategory;
  const activeMonth =
    effectiveMonthInput !== undefined
      ? effectiveMonthInput
      : syncWithUrl
      ? urlSync.urlState.month
      : localMonth;

  const handleSearchChange = React.useCallback(
    (q: string) => {
      if (syncWithUrl) {
        urlSync.setSearch(q);
      } else {
        setLocalSearch(q);
      }
    },
    [syncWithUrl, urlSync]
  );

  const handleTabChange = React.useCallback(
    (tab: SmartFilterTab) => {
      if (syncWithUrl) {
        urlSync.setTab(tab);
      } else {
        setLocalTab(tab);
      }
    },
    [syncWithUrl, urlSync]
  );

  const handleDeptChange = React.useCallback(
    (dept: string) => {
      if (syncWithUrl) {
        urlSync.setDept(dept);
      } else {
        setLocalDept(dept);
      }
    },
    [syncWithUrl, urlSync]
  );

  const handleCategoryChange = React.useCallback(
    (cat: TaskCategory | "ALL") => {
      if (syncWithUrl) {
        urlSync.setCategory(cat);
      } else {
        setLocalCategory(cat);
      }
    },
    [syncWithUrl, urlSync]
  );

  const handleMonthChange = React.useCallback(
    (m: number | "ALL") => {
      setLocalMonth(m);
      effectiveOnMonthChange?.(m);
      if (syncWithUrl) {
        urlSync.setMonth(m);
      }
    },
    [syncWithUrl, urlSync, effectiveOnMonthChange]
  );

  const handleResetFilters = React.useCallback(() => {
    if (syncWithUrl) {
      urlSync.resetFilters();
    } else {
      setLocalSearch("");
      setLocalTab("all");
      setLocalDept("ALL");
      setLocalCategory("ALL");
      setLocalMonth("ALL");
    }
  }, [syncWithUrl, urlSync]);

  // 4. Backlog State
  const [isBacklogExpanded, setIsBacklogExpanded] = React.useState<boolean>(true);

  // 5. Data Filtering
  const filteredTasks = React.useMemo(() => {
    return filterTasks(tasks, {
      searchQuery: activeSearch,
      smartTab: activeTab,
      category: activeCategory,
      department: activeDept,
      currentUserId: user?.id,
      currentUserName: user?.name,
      currentUserDepartment: user?.department,
      referenceDate,
      month: activeMonth,
    });
  }, [
    tasks,
    activeSearch,
    activeTab,
    activeCategory,
    activeDept,
    user?.id,
    user?.name,
    user?.department,
    referenceDate,
    activeMonth,
  ]);

  // 6. Smart Tab Counts
  const tabCounts = React.useMemo(() => {
    return aggregateFilterCounts(tasks, {
      currentUserId: user?.id,
      currentUserName: user?.name,
      referenceDate,
      month: activeMonth,
    });
  }, [tasks, user?.id, user?.name, referenceDate, activeMonth]);

  // 7. Auto-expansion in personal scope
  const isPersonalScope =
    scope === "MY_TASKS" ||
    scope === "my" ||
    activeTab === "my_tasks" ||
    defaultExpanded === true;

  const autoExpandedParentIds = React.useMemo(() => {
    if (!isPersonalScope) return [];
    return tasks
      .filter((t) => {
        if (!t.subTasks || t.subTasks.length === 0) return false;
        if (defaultExpanded) return true;
        if (user) {
          return t.subTasks.some((sub) => {
            const subAny = sub as any;
            return (
              (user.id && (sub.assigneeId === user.id || subAny.assignedTo === user.id)) ||
              matchesUser(sub.assigneeName, user) ||
              matchesUser(subAny.assignedTo, user) ||
              subAny.collaborators?.some((c: any) => matchesUser(c.name, user) || (user.id && c.id === user.id))
            );
          });
        }
        return true;
      })
      .map((t) => t.id);
  }, [tasks, isPersonalScope, defaultExpanded, user]);

  // 8. Table State Hook (Selection, Expansion, Pagination, Sorting, Density)
  const tableState = useTaskTableState({
    totalItems: filteredTasks.length,
    initialPage: 1,
    initialPageSize,
    initialDensity: effectiveInitialDensity,
    initialSortField: "dueDate",
    initialSortDirection: "asc",
    initialExpandedIds: autoExpandedParentIds,
  });

  // 5b. P0-07 / R-T07-bulk: lifecycle targets valid for the ENTIRE selection.
  // Derived from the canonical capability engine, never from a role string.
  // Note: SchoolTask carries no creator identity, so the engine's SoD
  // anti-self-approval rule cannot be evaluated client-side from this row type —
  // the server remains the enforcement point for it.
  const allowedLifecycleTargets = React.useMemo<TaskStatus[]>(() => {
    const selectedIds = tableState.selectedIds;
    if (!selectedIds || selectedIds.size === 0) return [];

    const actorContract: TaskActorContract | null = user
      ? {
          id: user.id,
          role: user.role,
          departmentId: user.departmentCode ?? null,
        }
      : null;

    const selectedEntities: TaskEntityContract[] = filteredTasks
      .filter((task) => selectedIds.has(task.id))
      .map((task) => {
        const ownerId = task.leadAssigneeId ?? null;
        return {
          id: task.id,
          status: task.status,
          departmentId: task.leadDepartmentId ?? task.departmentId ?? null,
          primaryOwnerId: ownerId,
          driId: ownerId,
          assigneeIds: ownerId ? [ownerId] : [],
        };
      });

    return filterBulkTransitionTargets(
      selectedEntities,
      BULK_LIFECYCLE_CANDIDATES,
      actorContract
    );
  }, [tableState.selectedIds, filteredTasks, user]);

  const prevAutoExpandedKeyRef = React.useRef<string>("");  React.useEffect(() => {
    if (propDensity && tableState.density !== propDensity) {
      tableState.setDensity(propDensity);
    }
  }, [propDensity, tableState.density, tableState.setDensity]);

  React.useEffect(() => {
    const key = `${isPersonalScope}-${autoExpandedParentIds.join(",")}`;
    if (isPersonalScope && autoExpandedParentIds.length > 0 && prevAutoExpandedKeyRef.current !== key) {
      prevAutoExpandedKeyRef.current = key;
      tableState.expandAll(autoExpandedParentIds);
    }
  }, [isPersonalScope, autoExpandedParentIds, tableState.expandAll]);

  // 8. Sorting Data
  const sortedTasks = React.useMemo(() => {
    return sortTasks(filteredTasks, {
      field: tableState.sortField,
      direction: tableState.sortDirection,
    });
  }, [filteredTasks, tableState.sortField, tableState.sortDirection]);

  // 9. Pagination
  const paginatedResult = React.useMemo(() => {
    return paginateTasks(sortedTasks, tableState.currentPage, tableState.pageSize);
  }, [sortedTasks, tableState.currentPage, tableState.pageSize]);

  const visibleIds = React.useMemo(() => {
    return paginatedResult.items.map((t) => t.id);
  }, [paginatedResult.items]);

  // 10. Table Container Ref, Task Selection & URL Deep Linking
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleEffectiveSelectTask = React.useCallback(
    (task: SchoolTask | StaffTask) => {
      if (syncWithUrl) {
        urlSync.setTaskId(task.id);
      }
      onSelectTask?.(task);
    },
    [syncWithUrl, urlSync, onSelectTask]
  );

  // Sync selected task from URL search params on mount or param update
  React.useEffect(() => {
    if (syncWithUrl && urlSync.urlState.taskId && !selectedTaskId) {
      const targetId = urlSync.urlState.taskId;
      const found = tasks.find(
        (t) => t.id === targetId || t.code?.toUpperCase() === targetId.toUpperCase()
      );
      if (found) {
        onSelectTask?.(found);
      } else {
        for (const t of tasks) {
          const sub = t.subTasks?.find(
            (s) => s.id === targetId || (s as any).code?.toUpperCase() === targetId.toUpperCase()
          );
          if (sub) {
            onSelectTask?.(sub);
            break;
          }
        }
      }
    }
  }, [syncWithUrl, urlSync.urlState.taskId, selectedTaskId, tasks, onSelectTask]);

  const keyboardNav = useTaskKeyboardNav({
    items: paginatedResult.items,
    enabled: true,
    containerRef,
    isExpanded: (id) => tableState.isExpanded(id),
    hasSubtasks: (id) => {
      const task = paginatedResult.items.find((t) => t.id === id);
      return Boolean(task?.subTasks && task.subTasks.length > 0);
    },
    onSelectTask: (id) => {
      const task = paginatedResult.items.find((t) => t.id === id);
      if (task) {
        handleEffectiveSelectTask(task);
      }
    },
    onToggleSelect: (id) => tableState.toggleSelect(id),
    onToggleExpand: (id, expand) => tableState.toggleExpand(id, expand),
    onClearSelection: () => tableState.clearSelection(),
    onFocusSearch: () => {
      window.dispatchEvent(new CustomEvent("qcet:focus-task-search"));
    },
    onEscape: () => {
      if (selectedTaskId || (syncWithUrl && urlSync.urlState.taskId)) {
        if (syncWithUrl) {
          urlSync.setTaskId(null);
        }
        window.dispatchEvent(new CustomEvent("qcet:close-task-detail"));
      } else if (tableState.selectedCount > 0) {
        tableState.clearSelection();
      } else if (activeSearch) {
        handleSearchChange("");
      } else {
        keyboardNav.resetActive();
      }
    },
  });

  // Tự động cuộn đến hàng đang nhận focus bàn phím
  React.useEffect(() => {
    if (!containerRef.current || !keyboardNav.activeId) return;
    const activeEl = containerRef.current.querySelector(
      `[data-task-id="${keyboardNav.activeId}"]`
    ) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [keyboardNav.activeId]);

  // 11. Pull to refresh for mobile
  const pullToRefresh = usePullToRefresh({
    onRefresh: onRefresh ? async () => { await onRefresh(); } : undefined,
  });

  // 12. Month Period & Indicator
  const monthPeriod = React.useMemo(() => {
    if (typeof selectedAcademicMonth === "number") {
      return getAcademicMonthPeriod(selectedAcademicMonth);
    }
    return null;
  }, [selectedAcademicMonth]);

  const monthlyIndicator = React.useMemo(() => {
    if (selectedAcademicMonth === undefined) return null;
    if (selectedAcademicMonth === "ALL") {
      return `Toàn năm học - ${filteredTasks.length} nhiệm vụ`;
    }
    const dateSpan = monthPeriod
      ? `(${monthPeriod.shortDateSpan}/${monthPeriod.endDate.slice(0, 4)})`
      : "";
    return `Kỳ vận hành Tháng ${selectedAcademicMonth} ${dateSpan} - ${filteredTasks.length} nhiệm vụ`;
  }, [selectedAcademicMonth, monthPeriod, filteredTasks.length]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Bảng điều hành phân cấp nhiệm vụ"
      tabIndex={0}
      data-slot="cascading-task-table"
      onKeyDown={keyboardNav.handleKeyDown}
      className={cn(
        "flex flex-col gap-3.5 outline-hidden select-text transition-colors",
        className
      )}
    >
      {/* 1. Monthly Indicator Header */}
      {monthlyIndicator && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-primary/[0.04] border border-primary/20 text-xs sm:text-sm font-semibold text-primary shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary shrink-0" />
            <span>{monthlyIndicator}</span>
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="h-7 px-2 text-xs text-primary hover:bg-primary/10 transition-colors"
            >
              <RotateCcw className="size-3.5 mr-1" strokeWidth={1.5} />
              Làm mới
            </Button>
          )}
        </div>
      )}

      {/* 2. Prior Overdue Backlog Collapsible Section */}
      {selectedAcademicMonth !== "ALL" &&
        priorOverdueBacklog &&
        priorOverdueBacklog.length > 0 && (
          <section
            aria-label="Nhiệm vụ tồn đọng kỳ trước"
            className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-2xs space-y-3 transition-all"
          >
            {/* Section Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="flex size-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-900 border border-amber-500/30">
                  <RotateCcw className="size-4" strokeWidth={1.5} />
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-amber-950 uppercase tracking-wide">
                    TỒN ĐỌNG KỲ TRƯỚC ({priorOverdueBacklog.length})
                  </h3>
                  <Badge variant="rose" className="text-xs font-semibold">
                    Prior Overdue Backlog
                  </Badge>
                </div>
                <span className="text-xs text-amber-900/80 font-medium hidden lg:inline">
                  Nhiệm vụ quá hạn từ các kỳ trước chuyển sang kỳ này cần ưu tiên xử lý
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsBacklogExpanded(!isBacklogExpanded)}
                className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[32px] rounded-lg border border-amber-300/80 bg-white/80 hover:bg-white text-xs font-semibold text-amber-950 transition-colors cursor-pointer"
                aria-expanded={isBacklogExpanded}
                aria-label={
                  isBacklogExpanded
                    ? "Thu gọn tồn đọng kỳ trước"
                    : "Mở rộng tồn đọng kỳ trước"
                }
              >
                <span>{isBacklogExpanded ? "Thu gọn" : "Xem chi tiết"}</span>
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    isBacklogExpanded && "rotate-180"
                  )}
                  strokeWidth={1.5}
                />
              </button>
            </div>

            {/* Collapsible Backlog Content */}
            {isBacklogExpanded && (
              <div className="space-y-2 pt-1 border-t border-amber-200/70">
                {/* Desktop Backlog Table */}
                <div className="hidden md:block overflow-hidden rounded-xl border border-amber-200/80 bg-white/90 shadow-2xs">
                  <div className="overflow-x-auto thin-scrollbar">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="h-9 border-b border-amber-200/60 bg-amber-100/40 text-xs font-semibold text-amber-900 uppercase">
                          <th className="w-24 px-3 py-1.5">Mã NV</th>
                          <th className="px-3 py-1.5">Nhiệm vụ tồn đọng</th>
                          <th className="px-3 py-1.5">Chủ trì</th>
                          <th className="px-3 py-1.5">Hạn ban đầu</th>
                          <th className="px-3 py-1.5">Tiến độ</th>
                          <th className="w-52 px-3 py-1.5 text-right">
                            Trạng thái &amp; Thao tác
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100/80">
                        {priorOverdueBacklog.map((task) => (
                          <tr
                            key={task.id}
                            tabIndex={0}
                            onClick={() => handleEffectiveSelectTask(task)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleEffectiveSelectTask(task);
                              }
                            }}
                            className="group cursor-pointer hover:bg-amber-100/30 transition-colors h-11 text-xs"
                            data-backlog-task-id={task.id}
                          >
                            <td className="px-3 py-2 font-mono font-bold text-amber-900 tabular-nums">
                              {task.taskCode || "NV-QCET"}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                {task.title}
                              </div>
                              {task.categoryLabel && (
                                <span className="text-xs text-muted-foreground font-medium">
                                  {task.categoryLabel}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground font-medium">
                              {task.leadAssigneeName}
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-mono font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-xs tabular-nums">
                                {task.dueDate ? formatTableDate(task.dueDate) : "Quá hạn"}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="relative h-1.5 w-12 overflow-hidden rounded-full bg-secondary/80">
                                  <div
                                    className="h-full bg-amber-500"
                                    style={{
                                      width: `${task.progressPercent || 0}%`,
                                    }}
                                  />
                                </div>
                                <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                                  {task.progressPercent || 0}%
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {onStatusChange && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onStatusChange(
                                        task.id,
                                        task.status === "COMPLETED"
                                          ? "IN_PROGRESS"
                                          : "COMPLETED"
                                      );
                                    }}
                                    className="inline-flex h-6 items-center px-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                                  >
                                    Duyệt nhanh
                                  </button>
                                )}
                                <Badge
                                  variant="rose"
                                  className="h-5.5 px-2 text-xs font-semibold tabular-nums shrink-0"
                                >
                                  Tồn đọng
                                </Badge>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Backlog Cards */}
                <div className="md:hidden space-y-2">
                  {priorOverdueBacklog.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleEffectiveSelectTask(task)}
                      className="rounded-xl border border-amber-200/90 bg-white/90 p-3 shadow-2xs space-y-2 cursor-pointer active:bg-amber-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-amber-900 tabular-nums">
                          {task.taskCode || "NV-QCET"}
                        </span>
                        <Badge variant="rose" className="text-xs font-semibold">
                          Tồn đọng
                        </Badge>
                      </div>
                      <h4 className="text-xs font-bold text-foreground line-clamp-2">
                        {task.title}
                      </h4>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-amber-100">
                        <span>{task.leadAssigneeName}</span>
                        <span className="font-mono font-semibold text-rose-700 tabular-nums">
                          {task.dueDate ? formatTableDate(task.dueDate) : "Quá hạn"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

      {/* 3. Main Interactive Toolbar */}
      {!hideToolbar && (
        <TaskTableToolbar
          searchQuery={activeSearch}
          onSearchChange={handleSearchChange}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          pillCounts={tabCounts}
          selectedAcademicMonth={activeMonth}
          onAcademicMonthChange={handleMonthChange}
          selectedDepartment={activeDept}
          onDepartmentChange={handleDeptChange}
          selectedCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          density={tableState.density}
          onDensityChange={tableState.setDensity}
          onAddTask={onAddTask}
          totalTasksCount={filteredTasks.length}
        />
      )}

      {/* 4. Table Content: Empty State vs Data Feed */}
      {sortedTasks.length === 0 ? (
        <TaskEmptyState
          searchQuery={activeSearch}
          activeTab={activeTab}
          department={activeDept}
          category={activeCategory}
          onResetFilters={handleResetFilters}
          onAddTask={onAddTask}
          canAddTask={canAssignUnit}
        />
      ) : (
        <div className="space-y-3">
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
            <div className="overflow-x-auto thin-scrollbar">
              <table className="w-full text-left">
                <TaskTableHeader
                  allSelected={tableState.allVisibleSelected}
                  indeterminate={tableState.someVisibleSelected}
                  onToggleSelectAll={(sel) => {
                    if (sel) {
                      tableState.selectAll(visibleIds);
                    } else {
                      tableState.clearSelection();
                    }
                  }}
                  sortField={tableState.sortField}
                  sortDirection={tableState.sortDirection}
                  onSort={tableState.handleSort}
                  density={tableState.density}
                  showSelection={true}
                  showExpandAll={true}
                  isAllExpanded={tableState.expandedIds.size > 0}
                  onToggleExpandAll={() => {
                    if (tableState.expandedIds.size > 0) {
                      tableState.collapseAll();
                    } else {
                      tableState.expandAll(paginatedResult.items.map((t) => t.id));
                    }
                  }}
                  hasTasks={paginatedResult.items.length > 0}
                />
                <tbody className="divide-y divide-border/60">
                  {paginatedResult.items.map((task, index) => {
                    const isExpanded = tableState.isExpanded(task.id);
                    const isSelected = tableState.isSelected(task.id);
                    const isRowActive =
                      keyboardNav.activeIndex === index ||
                      task.id === selectedTaskId ||
                      Boolean(task.code && task.code === selectedTaskId);
                    const hasSubtasks = Boolean(
                      task.subTasks && task.subTasks.length > 0
                    );

                    return (
                      <React.Fragment key={task.id}>
                        <TaskRow
                          task={task}
                          isExpanded={isExpanded}
                          isSelected={isSelected}
                          isActive={isRowActive}
                          density={tableState.density}
                          selectedAcademicMonth={selectedAcademicMonth}
                          activeCategory={activeCategory}
                          canAssign={canAssignUnit}
                          onAddSubTask={effectiveOnAddSubTask}
                          onToggleExpand={() => tableState.toggleExpand(task.id)}
                          onToggleSelect={() => tableState.toggleSelect(task.id)}
                          onClick={handleEffectiveSelectTask}
                          onStatusChange={onStatusChange}
                          onUrge={onUrge}
                        />
                        {isExpanded && hasSubtasks && (
                          <SubtaskRowGroup
                            parentTask={task}
                            scope={scope}
                            isExpanded={isExpanded}
                            density={tableState.density}
                            colSpan={8}
                            selectedAcademicMonth={selectedAcademicMonth}
                            onSelectSubTask={(sub) => handleEffectiveSelectTask(sub)}
                            onStatusChange={onStatusChange}
                            onOpenSubmitModal={onOpenSubmitModal}
                            onAddSubTask={effectiveOnAddSubTask}
                            canAssign={canAssignUnit}
                            selectedTaskId={selectedTaskId}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Feed View (< 768px) */}
          <div className="md:hidden space-y-2.5">
            {paginatedResult.items.map((task) => (
              <MobileTaskCard
                key={task.id}
                task={task}
                isExpanded={tableState.isExpanded(task.id)}
                onToggleExpand={(id, e) => {
                  e?.stopPropagation?.();
                  tableState.toggleExpand(id);
                }}
                onSelectTask={handleEffectiveSelectTask}
                onStatusChange={onStatusChange}
                selectedAcademicMonth={selectedAcademicMonth}
                onOpenSubmitModal={onOpenSubmitModal}
                onAddSubTask={effectiveOnAddSubTask}
                canAssign={canAssignUnit}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          <TaskPaginationBar
            currentPage={tableState.currentPage}
            pageSize={tableState.pageSize}
            totalItems={tableState.totalItems}
            onPageChange={tableState.setPage}
            onPageSizeChange={tableState.setPageSize}
            shortcutTrigger={<TableShortcutHelpTrigger />}
          />
        </div>
      )}

      {/* 5. Floating Bulk Action Bar */}
      {/* P0-07 / R-T07-bulk: expose only lifecycle transitions valid for EVERY
          selected task, so an actor cannot launder approval authority through a
          bulk call. Computed from the canonical capability engine. */}
      <TaskBulkActionBar
        selectedCount={tableState.selectedCount}
        selectedIds={Array.from(tableState.selectedIds)}
        totalCount={filteredTasks.length}
        onClearSelection={tableState.clearSelection}
        onBulkStatusChange={onBulkStatusChange}
        onBulkExtendDeadline={onBulkExtendDeadline}
        onBulkReassign={onBulkReassign}
        onBulkDelete={onBulkDelete}
        onExportExcel={onExportExcel}
        allowedLifecycleTargets={allowedLifecycleTargets}
      />
    </div>
  );
}
