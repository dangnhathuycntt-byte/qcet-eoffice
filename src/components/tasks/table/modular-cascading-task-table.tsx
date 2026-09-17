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
  TaskPriority,
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
  TableColumnVisibility,
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
import { TaskContextMenu } from "./task-context-menu";
import { LinearPeekPreviewModal } from "@/components/tasks/preview/linear-peek-preview-modal";
import { shouldIgnoreSpaceKey, isInteractiveInput } from "@/lib/shortcuts/guards";
import { SubtaskRowGroup } from "./components/subtask-row-group";
import { TaskPaginationBar } from "./components/task-pagination-bar";
import { TaskEmptyState, type TaskEmptyStateProps } from "./components/task-empty-state";
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
  hidePagination?: boolean;
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
  visibleColumns?: TableColumnVisibility;
  onVisibleColumnsChange?: (cols: TableColumnVisibility) => void;
  initialPageSize?: number;
  syncWithUrl?: boolean;
  referenceDate?: string | Date;
  onBulkStatusChange?: (status: TaskStatus) => Promise<void> | void;
  onBulkExtendDeadline?: (newDueDate: string) => Promise<void> | void;
  onBulkReassign?: (newAssigneeId: string) => Promise<void> | void;
  onBulkDelete?: (taskIds: string[]) => Promise<void> | void;
  onPriorityChange?: (taskId: string, newPriority: TaskPriority) => Promise<void> | void;
  onDueDateChange?: (taskId: string, newDueDate: string) => Promise<void> | void;
  onDeleteTask?: (taskId: string) => Promise<void> | void;
  onExportExcel?: () => void;
  selectedTaskId?: string;
  emptyStateProps?: Partial<TaskEmptyStateProps>;
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
  hidePagination = false,
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
  visibleColumns: propVisibleColumns,
  onVisibleColumnsChange: propOnVisibleColumnsChange,
  initialPageSize = DEFAULT_PAGE_SIZE,
  syncWithUrl = false,
  referenceDate = getSystemReferenceDate(),
  onBulkStatusChange,
  onBulkExtendDeadline,
  onBulkReassign,
  onBulkDelete,
  onPriorityChange,
  onDueDateChange,
  onDeleteTask,
  onExportExcel,
  selectedTaskId,
  emptyStateProps,
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

  const [localVisibleColumns, setLocalVisibleColumns] =
    React.useState<TableColumnVisibility>(
      propVisibleColumns ?? { priority: true, subtasks: true, progress: true }
    );

  const effectiveVisibleColumns = propVisibleColumns ?? localVisibleColumns;
  const handleVisibleColumnsChange = React.useCallback(
    (cols: TableColumnVisibility) => {
      setLocalVisibleColumns(cols);
      propOnVisibleColumnsChange?.(cols);
    },
    [propOnVisibleColumnsChange]
  );

  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const activeColSpan = React.useMemo(() => {
    let span = 5; // Title + Status + Lead + Due + Actions = 5
    if (effectiveVisibleColumns.priority !== false) span++;
    if (effectiveVisibleColumns.subtasks !== false) span++;
    if (effectiveVisibleColumns.progress !== false) span++;
    return span; // total columns without checkbox
  }, [effectiveVisibleColumns]);

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

  // 4b. Context Menu State (Linear Image #7)
  const [contextMenu, setContextMenu] = React.useState<{
    isOpen: boolean;
    position: { x: number; y: number } | null;
    task: SchoolTask | null;
    triggerElement: HTMLElement | null;
  }>({
    isOpen: false,
    position: null,
    task: null,
    triggerElement: null,
  });

  const handleRowContextMenu = React.useCallback(
    (task: SchoolTask, e: React.MouseEvent) => {
      e.preventDefault();
      const targetEl = (e.currentTarget || e.target) as HTMLElement | null;
      setContextMenu({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
        task,
        triggerElement: targetEl,
      });
    },
    []
  );

  const handleCloseContextMenu = React.useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // 4c. Peek Preview Modal State (REQ-09 / REQ-10)
  const [previewTask, setPreviewTask] = React.useState<SchoolTask | null>(null);
  const [previewTriggerEl, setPreviewTriggerEl] = React.useState<HTMLElement | null>(null);

  const handleClosePeekPreview = React.useCallback(() => {
    setPreviewTask(null);
  }, []);

  const handleContextMenuPriorityChange = React.useCallback(
    async (taskId: string, newPriority: TaskPriority) => {
      if (onPriorityChange) {
        await onPriorityChange(taskId, newPriority);
      }
      const target = tasks.find((t) => t.id === taskId);
      if (target) {
        target.priority = newPriority === "MEDIUM" ? "NORMAL" : newPriority;
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("qcet:task-priority-changed", {
            detail: { taskId, priority: newPriority },
          })
        );
      }
    },
    [onPriorityChange, tasks]
  );

  const handleContextMenuDueDateChange = React.useCallback(
    async (taskId: string, newDueDate: string) => {
      if (onDueDateChange) {
        await onDueDateChange(taskId, newDueDate);
      } else if (onBulkExtendDeadline) {
        await onBulkExtendDeadline(newDueDate);
      }
      const target = tasks.find((t) => t.id === taskId);
      if (target) {
        target.dueDate = newDueDate;
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("qcet:task-due-date-changed", {
            detail: { taskId, dueDate: newDueDate },
          })
        );
      }
    },
    [onDueDateChange, onBulkExtendDeadline, tasks]
  );

  const handleContextMenuDelete = React.useCallback(
    async (taskId: string) => {
      if (onDeleteTask) {
        await onDeleteTask(taskId);
      } else if (onBulkDelete) {
        await onBulkDelete([taskId]);
      } else if (onStatusChange) {
        await onStatusChange(taskId, "CANCELLED");
      }
    },
    [onDeleteTask, onBulkDelete, onStatusChange]
  );

  // 5. Data Filtering
  // When hideToolbar=true, the parent workspace has already filtered the task list.
  // Do NOT filter again to avoid double-filtering pre-filtered data from the parent.
  const filteredTasks = React.useMemo(() => {
    if (hideToolbar) {
      return tasks;
    }
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
    hideToolbar,
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

  const handlePageChange = React.useCallback(
    (newPage: number) => {
      tableState.setPage(newPage);
      if (typeof window !== "undefined") {
        if (tableContainerRef.current) {
          const topbarHeight = window.innerWidth >= 768 ? 0 : 48;
          const rect = tableContainerRef.current.getBoundingClientRect();
          const targetY = rect.top + window.scrollY - topbarHeight - 12;
          window.scrollTo({
            top: Math.max(0, targetY),
            behavior: "smooth",
          });
        }
      }
    },
    [tableState]
  );

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

  const effectiveOnBulkStatusChange = React.useMemo(() => {
    if (onBulkStatusChange) return onBulkStatusChange;
    if (onStatusChange) {
      return async (newStatus: TaskStatus) => {
        const ids = Array.from(tableState.selectedIds);
        await Promise.all(ids.map((id) => onStatusChange(id, newStatus)));
        tableState.clearSelection();
      };
    }
    return undefined;
  }, [onBulkStatusChange, onStatusChange, tableState]);

  const effectiveOnBulkExtendDeadline = React.useMemo(() => {
    if (onBulkExtendDeadline) return onBulkExtendDeadline;
    if (handleContextMenuDueDateChange) {
      return async (newDueDate: string) => {
        const ids = Array.from(tableState.selectedIds);
        await Promise.all(ids.map((id) => handleContextMenuDueDateChange(id, newDueDate)));
        tableState.clearSelection();
      };
    }
    return undefined;
  }, [onBulkExtendDeadline, handleContextMenuDueDateChange, tableState]);

  const effectiveOnBulkDelete = React.useMemo(() => {
    if (onBulkDelete) return onBulkDelete;
    if (handleContextMenuDelete) {
      return async (ids: string[]) => {
        await Promise.all(ids.map((id) => handleContextMenuDelete(id)));
        tableState.clearSelection();
      };
    }
    return undefined;
  }, [onBulkDelete, handleContextMenuDelete, tableState]);

  const effectiveOnExportExcel = React.useMemo(() => {
    if (onExportExcel) return onExportExcel;
    return () => {
      const selected = filteredTasks.filter((t) => tableState.selectedIds.has(t.id));
      if (selected.length === 0) return;
      const headers = ["Mã nhiệm vụ", "Tiêu đề", "Đơn vị", "Chủ trì", "Hạn chót", "Trạng thái", "Tiến độ"];
      const rows = selected.map((t) => [
        `"${t.code || t.id}"`,
        `"${(t.title || "").replace(/"/g, '""')}"`,
        `"${t.department || t.leadDepartment || ""}"`,
        `"${t.leadAssigneeName || ""}"`,
        `"${t.dueDate || ""}"`,
        `"${t.status || ""}"`,
        `"${t.progressPercent ?? 0}%"`,
      ]);
      const csvContent = "﻿" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `danh-sach-nhiem-vu-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
  }, [onExportExcel, filteredTasks, tableState.selectedIds]);

  const prevFilterKeyRef = React.useRef<string>("");
  React.useEffect(() => {
    const currentKey = hideToolbar
      ? `${tasks.length}-${tasks.map((t) => t.id).slice(0, 10).join(",")}`
      : `${scope || ""}-${activeSearch || ""}-${activeTab || ""}-${activeDept || ""}-${activeCategory || ""}-${activeMonth || ""}`;
    if (prevFilterKeyRef.current && prevFilterKeyRef.current !== currentKey) {
      tableState.setPage(1);
    }
    prevFilterKeyRef.current = currentKey;
  }, [hideToolbar, tasks, scope, activeSearch, activeTab, activeDept, activeCategory, activeMonth, tableState.setPage]);

  React.useEffect(() => {
    if (propDensity && tableState.density !== propDensity) {
      tableState.setDensity(propDensity);
    }
  }, [propDensity, tableState.density, tableState.setDensity]);

  const prevAutoExpandedKeyRef = React.useRef<string>("");

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
    onSpacePeek: (id) => {
      const task = findTaskById(id);
      if (task) {
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur?.();
        }
        setPreviewTask(task);
        setPreviewTriggerEl(document.activeElement as HTMLElement | null);
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

  // 11b. Linear Mouse-Hover & Keyboard Space Peek Preview (REQ-09 / REQ-10)
  const hoveredTaskIdRef = React.useRef<string | null>(null);

  const updateHoveredTaskFromEvent = React.useCallback((target: EventTarget | null) => {
    const rowEl = (target as HTMLElement)?.closest?.("[data-task-id]");
    if (rowEl) {
      const id = rowEl.getAttribute("data-task-id");
      if (id) {
        hoveredTaskIdRef.current = id;
      }
      // Tránh lỗi Space kích hoạt lại button/tab bên ngoài (ví dụ menu sidebar vừa bấm)
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && !containerRef.current?.contains(activeEl) && !isInteractiveInput(activeEl)) {
        activeEl.blur?.();
      }
    }
  }, []);

  const handlePointerOver = React.useCallback((e: React.PointerEvent) => {
    updateHoveredTaskFromEvent(e.target);
  }, [updateHoveredTaskFromEvent]);

  const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
    updateHoveredTaskFromEvent(e.target);
  }, [updateHoveredTaskFromEvent]);

  const handlePointerLeave = React.useCallback(() => {
    hoveredTaskIdRef.current = null;
  }, []);

  // Helper tìm task theo ID (cả task cha và subtasks)
  const findTaskById = React.useCallback(
    (id: string): SchoolTask | undefined => {
      const parent = paginatedResult.items.find((t) => t.id === id);
      if (parent) return parent;
      for (const t of paginatedResult.items) {
        const sub = t.subTasks?.find((s) => s.id === id);
        if (sub) return sub as unknown as SchoolTask;
      }
      return undefined;
    },
    [paginatedResult.items]
  );

  const handleTableKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === " ") {
        if (e.repeat || previewTask) {
          return;
        }

        // Chỉ bỏ qua nếu đang nhập văn bản trong input/textarea
        if (!isInteractiveInput(e.target as HTMLElement | null)) {
          let targetTask: SchoolTask | undefined = undefined;

          // 1. Ưu tiên 1: Nhiệm vụ đang được con trỏ chuột rê/hover vào (Linear hover peek)
          if (hoveredTaskIdRef.current) {
            targetTask = findTaskById(hoveredTaskIdRef.current);
          }

          // 2. Ưu tiên 2: Nhiệm vụ đang active bằng phím tắt J/K
          if (!targetTask && keyboardNav.activeId) {
            targetTask = findTaskById(keyboardNav.activeId);
          }

          // 3. Fallback: Active index hoặc DOM focus
          if (
            !targetTask &&
            keyboardNav.activeIndex >= 0 &&
            keyboardNav.activeIndex < paginatedResult.items.length
          ) {
            targetTask = paginatedResult.items[keyboardNav.activeIndex];
          }
          if (!targetTask) {
            const focusedEl = document.activeElement as HTMLElement | null;
            const taskId = focusedEl
              ?.closest?.("[data-task-id]")
              ?.getAttribute("data-task-id");
            if (taskId) {
              targetTask = findTaskById(taskId);
            }
          }

          if (targetTask) {
            e.preventDefault();
            e.stopPropagation();
            if (document.activeElement && document.activeElement !== document.body) {
              (document.activeElement as HTMLElement).blur?.();
            }
            setPreviewTask(targetTask);
            setPreviewTriggerEl(document.activeElement as HTMLElement | null);
            return;
          }
        }
      }

      keyboardNav.handleKeyDown(e);
    },
    [keyboardNav, paginatedResult.items, findTaskById, previewTask]
  );

  // Global listener: Nhấn Space để mở Peek Preview (Linear / macOS Quick Look style)
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " && !e.repeat && !previewTask) {
        // Chỉ bỏ qua nếu đang nhập liệu trong input/textarea
        if (isInteractiveInput(e.target as HTMLElement | null)) {
          return;
        }

        let targetTask: SchoolTask | undefined = undefined;
        if (hoveredTaskIdRef.current) {
          targetTask = findTaskById(hoveredTaskIdRef.current);
        }
        if (!targetTask) {
          // Kiểm tra xem activeElement có nằm trong một task row không
          const activeEl = document.activeElement as HTMLElement | null;
          const activeTaskId = activeEl?.closest?.("[data-task-id]")?.getAttribute("data-task-id");
          if (activeTaskId) {
            targetTask = findTaskById(activeTaskId);
          }
        }
        if (!targetTask && keyboardNav.activeId) {
          targetTask = findTaskById(keyboardNav.activeId);
        }
        if (!targetTask && typeof document !== "undefined") {
          // Fallback: tìm row đang :hover trong DOM
          const hoveredEl = document.querySelector("[data-task-id]:hover");
          const hoveredId = hoveredEl?.getAttribute("data-task-id");
          if (hoveredId) {
            targetTask = findTaskById(hoveredId);
          }
        }

        if (targetTask) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          // Nếu focus đang ở button/tab bên ngoài (như menu sidebar vừa click), blur ngay để tránh active menu
          if (document.activeElement && document.activeElement !== document.body) {
            (document.activeElement as HTMLElement).blur?.();
          }
          setPreviewTask(targetTask);
          setPreviewTriggerEl(document.activeElement as HTMLElement | null);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, { capture: true });
    };
  }, [findTaskById, previewTask, keyboardNav.activeId]);

  // 12. Month Period & Indicator
  const monthPeriod = React.useMemo(() => {
    if (typeof selectedAcademicMonth === "number") {
      return getAcademicMonthPeriod(selectedAcademicMonth);
    }
    return null;
  }, [selectedAcademicMonth]);

  const monthlyIndicator = React.useMemo(() => {
    if (selectedAcademicMonth === undefined || selectedAcademicMonth === "ALL") return null;
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
      onKeyDown={handleTableKeyDown}
      onPointerOver={handlePointerOver}
      onMouseMove={handleMouseMove}
      onPointerLeave={handlePointerLeave}
      className={cn(
        "flex flex-col gap-2.5 outline-hidden select-text transition-colors",
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

      {/* 2. Prior Overdue Backlog Collapsible Section (Linear streamlined hairline group) */}
      {selectedAcademicMonth !== "ALL" &&
        priorOverdueBacklog &&
        priorOverdueBacklog.length > 0 && (
          <section
            aria-label="Prior Overdue Backlog - Nhiệm vụ tồn đọng kỳ trước"
            className="border-b border-amber-300 bg-amber-50 text-xs transition-all select-none"
          >
            {/* Sleek Hairline Section Header */}
            <div
              onClick={() => setIsBacklogExpanded(!isBacklogExpanded)}
              className="flex items-center justify-between py-2 px-3 hover:bg-amber-100/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronDown
                  className={cn(
                    "size-3.5 text-amber-700 transition-transform duration-200",
                    !isBacklogExpanded && "-rotate-90"
                  )}
                  strokeWidth={1.5}
                />
                <span className="font-semibold text-amber-950 tracking-wide">
                  TỒN ĐỌNG KỲ TRƯỚC ({priorOverdueBacklog.length})
                </span>
                <span className="inline-flex items-center justify-center rounded-full bg-amber-200/80 text-amber-900 px-1.5 py-0.2 font-mono text-[10px] font-bold">
                  {priorOverdueBacklog.length}
                </span>
                <span className="text-[11px] text-amber-800/80 hidden sm:inline">
                  (Prior Overdue Backlog - Cần ưu tiên xử lý dứt điểm)
                </span>
              </div>
              <span className="text-[11px] font-medium text-amber-800">
                {isBacklogExpanded ? "Thu gọn" : "Xem chi tiết"}
              </span>
            </div>

            {/* Collapsible Flush Backlog Content */}
            {isBacklogExpanded && (
              <div className="border-t border-amber-200/60 bg-white/70">
                {/* Desktop Backlog Table */}
                <div className="hidden md:block overflow-x-auto thin-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="h-8 border-b border-amber-200/50 bg-amber-100/30 text-[11px] font-medium text-amber-900/80 uppercase">
                        <th className="w-24 px-3 py-1">Mã NV</th>
                        <th className="px-3 py-1">Nhiệm vụ tồn đọng</th>
                        <th className="px-3 py-1">Chủ trì</th>
                        <th className="px-3 py-1">Hạn ban đầu</th>
                        <th className="px-3 py-1">Tiến độ</th>
                        <th className="w-48 px-3 py-1 text-right">Trạng thái &amp; Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100/70">
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
                          className="group cursor-pointer hover:bg-amber-100/30 transition-colors h-10 text-xs"
                          data-backlog-task-id={task.id}
                        >
                          <td className="px-3 py-1.5 font-mono font-bold text-amber-900 tabular-nums">
                            {task.taskCode || "NV-QCET"}
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                              {task.title}
                            </div>
                            {task.categoryLabel && (
                              <span className="text-[11px] text-muted-foreground">
                                {task.categoryLabel}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground font-medium">
                            {task.leadAssigneeName}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="font-mono font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-xs tabular-nums">
                              {task.dueDate ? formatTableDate(task.dueDate) : "Quá hạn"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
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
                          <td className="px-3 py-1.5 text-right">
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
                                  className="inline-flex h-6 items-center px-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium cursor-pointer transition-colors"
                                >
                                  Duyệt nhanh
                                </button>
                              )}
                              <Badge
                                variant="rose"
                                className="h-5 px-1.5 text-[11px] font-semibold tabular-nums shrink-0"
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

                {/* Mobile Backlog Cards */}
                <div className="md:hidden p-2 space-y-1.5">
                  {priorOverdueBacklog.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleEffectiveSelectTask(task)}
                      className="rounded-lg border border-amber-200/80 bg-white/90 p-2.5 space-y-1.5 cursor-pointer active:bg-amber-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-amber-900 tabular-nums">
                          {task.taskCode || "NV-QCET"}
                        </span>
                        <Badge variant="rose" className="text-[10px] font-semibold">
                          Tồn đọng
                        </Badge>
                      </div>
                      <h4 className="text-xs font-semibold text-foreground line-clamp-2">
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
          visibleColumns={effectiveVisibleColumns}
          onVisibleColumnsChange={handleVisibleColumnsChange}
          onAddTask={onAddTask}
          totalTasksCount={filteredTasks.length}
        />
      )}

      {/* 4. Table Content: Empty State vs Data Feed */}
      {sortedTasks.length === 0 ? (
        <TaskEmptyState
          searchQuery={emptyStateProps?.searchQuery ?? activeSearch}
          activeTab={emptyStateProps?.activeTab ?? activeTab}
          attention={emptyStateProps?.attention}
          status={emptyStateProps?.status}
          academicMonth={emptyStateProps?.academicMonth ?? activeMonth}
          department={emptyStateProps?.department ?? activeDept}
          category={emptyStateProps?.category ?? activeCategory}
          priority={emptyStateProps?.priority}
          userName={emptyStateProps?.userName}
          onResetFilters={emptyStateProps?.onResetFilters ?? handleResetFilters}
          onAddTask={emptyStateProps?.onAddTask ?? onAddTask}
          canAddTask={emptyStateProps?.canAddTask ?? canAssignUnit}
        />
      ) : (
        <div ref={tableContainerRef} className="space-y-3 scroll-mt-[calc(48px+env(safe-area-inset-top,0px)+12px)] md:scroll-mt-4">
          {/* Desktop Table View (>= 768px) - Linear Soft Rounded Rows */}
          <div className="hidden md:block overflow-hidden bg-transparent">
            <div className="overflow-x-auto thin-scrollbar px-0.5 sm:px-1">
              <table className="w-full text-left border-separate border-spacing-y-[1.5px]">
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
                  visibleColumns={effectiveVisibleColumns}
                  showSelection={false}
                  showExpandAll={false}
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
                <tbody>
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
                      <TaskRow
                        key={task.id}
                        task={task}
                        scope={scope}
                        isExpanded={false}
                        isSelected={isSelected}
                        isActive={isRowActive}
                        isPreviewing={previewTask?.id === task.id}
                        density={tableState.density}
                        visibleColumns={effectiveVisibleColumns}
                        showSelection={false}
                        selectedAcademicMonth={selectedAcademicMonth}
                        activeCategory={activeCategory}
                        canAssign={canAssignUnit}
                        onAddSubTask={effectiveOnAddSubTask}
                        onToggleSelect={() => tableState.toggleSelect(task.id)}
                        onClick={handleEffectiveSelectTask}
                        onContextMenu={handleRowContextMenu}
                        onStatusChange={onStatusChange}
                        onUrge={onUrge}
                      />
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

          {/* Pagination Controls - Show only when totalItems > pageSize and not explicitly hidden */}
          {!hidePagination && tableState.totalItems > tableState.pageSize && (
            <TaskPaginationBar
              currentPage={tableState.currentPage}
              pageSize={tableState.pageSize}
              totalItems={tableState.totalItems}
              onPageChange={handlePageChange}
              onPageSizeChange={tableState.setPageSize}
            />
          )}
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
        onBulkStatusChange={effectiveOnBulkStatusChange}
        onBulkExtendDeadline={effectiveOnBulkExtendDeadline}
        onBulkReassign={onBulkReassign}
        onBulkDelete={effectiveOnBulkDelete}
        onExportExcel={effectiveOnExportExcel}
        allowedLifecycleTargets={allowedLifecycleTargets}
      />

      {/* 6. Context Menu (Linear Image #7) */}
      <TaskContextMenu
        task={contextMenu.task}
        position={contextMenu.position}
        isOpen={contextMenu.isOpen}
        onClose={handleCloseContextMenu}
        triggerElement={contextMenu.triggerElement}
        onOpenDetail={handleEffectiveSelectTask}
        onStatusChange={onStatusChange}
        onPriorityChange={handleContextMenuPriorityChange}
        onDueDateChange={handleContextMenuDueDateChange}
        onDeleteTask={handleContextMenuDelete}
      />

      {/* 7. Peek Preview Modal (REQ-09 / REQ-10 / REQ-23) */}
      <LinearPeekPreviewModal
        task={previewTask}
        isOpen={Boolean(previewTask)}
        onClose={handleClosePeekPreview}
        triggerElement={previewTriggerEl}
        onOpenDetail={(task) => {
          handleClosePeekPreview();
          handleEffectiveSelectTask(task);
        }}
        onNavigateNext={() => {
          if (!previewTask) return;
          const currentIndex = paginatedResult.items.findIndex(
            (t) => t.id === previewTask.id
          );
          if (
            currentIndex >= 0 &&
            currentIndex < paginatedResult.items.length - 1
          ) {
            const nextTask = paginatedResult.items[currentIndex + 1];
            setPreviewTask(nextTask);
            keyboardNav.setActiveIndex(currentIndex + 1);
          }
        }}
        onNavigatePrev={() => {
          if (!previewTask) return;
          const currentIndex = paginatedResult.items.findIndex(
            (t) => t.id === previewTask.id
          );
          if (currentIndex > 0) {
            const prevTask = paginatedResult.items[currentIndex - 1];
            setPreviewTask(prevTask);
            keyboardNav.setActiveIndex(currentIndex - 1);
          }
        }}
        hasPrev={
          previewTask
            ? paginatedResult.items.findIndex((t) => t.id === previewTask.id) >
              0
            : false
        }
        hasNext={
          previewTask
            ? paginatedResult.items.findIndex((t) => t.id === previewTask.id) <
              paginatedResult.items.length - 1
            : false
        }
      />
    </div>
  );
}
