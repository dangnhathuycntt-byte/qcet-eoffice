"use client";

import * as React from "react";
import Link from "next/link";
import {
  SchoolTask,
  StaffTask,
  DashboardPayload,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import { getMockDashboardPayload } from "@/lib/mock-dashboard-data";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
} from "@/lib/dashboard-aggregator";
import {
  CascadingTaskTable,
  CATEGORY_TABS,
  CategoryTab,
} from "@/components/dashboard/cascading-task-table";
import {
  TaskKanbanBoard,
  TaskLevelFilter,
} from "@/components/tasks/task-kanban-board";
import {
  CreateTaskModal,
  CreateTaskFormData,
  TaskLevel,
} from "@/components/dashboard/create-task-modal";
import {
  TaskDetailSideSheet,
  isSchoolTask,
} from "@/components/dashboard/task-detail-side-sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { filterTasksByRole } from "@/lib/role-task-filter";
import {
  LayoutGrid,
  List,
  Plus,
  Search,
  RefreshCw,
  Building2,
  Users,
  X,
} from "lucide-react";

export type ViewMode = "table" | "kanban";

export default function TasksPage() {
  const { user } = useAuth();

  // 1. Synchronous optimistic initial state
  const [dashboardData, setDashboardData] = React.useState<DashboardPayload>(
    () => getMockDashboardPayload()
  );
  const [selectedTask, setSelectedTask] = React.useState<
    SchoolTask | StaffTask | null
  >(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Filter tasks dynamically by active role viewpoint
  const visibleTasks = React.useMemo(
    () => filterTasksByRole(dashboardData.tasks, user),
    [dashboardData.tasks, user]
  );

  const parentSchoolTaskTitle = React.useMemo(() => {
    if (!selectedTask || isSchoolTask(selectedTask)) return undefined;
    const parent = dashboardData.tasks.find(
      (t) => t.id === selectedTask.parentSchoolTaskId
    );
    return parent?.title;
  }, [selectedTask, dashboardData.tasks]);

  // 2. View Mode & Filtering States
  const [viewMode, setViewMode] = React.useState<ViewMode>("kanban");
  const [activeCategory, setActiveCategory] = React.useState<
    TaskCategory | "ALL"
  >("ALL");
  const [levelFilter, setLevelFilter] = React.useState<TaskLevelFilter>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");

  // 3. Create Task Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [createInitialLevel, setCreateInitialLevel] =
    React.useState<TaskLevel>("TRUONG");
  const [createInitialParentId, setCreateInitialParentId] = React.useState<
    string | undefined
  >(undefined);

  // 4. Background Sync
  React.useEffect(() => {
    let isMounted = true;

    async function syncTasks() {
      try {
        const response = await fetch("/api/dashboard/overview");
        if (response.ok && isMounted) {
          const liveData: DashboardPayload = await response.json();
          if (liveData && liveData.tasks) {
            setDashboardData(liveData);
          }
        }
      } catch {
        // Retain optimistic payload
      }
    }

    syncTasks();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (response.ok) {
        const liveData: DashboardPayload = await response.json();
        if (liveData && liveData.tasks) {
          setDashboardData(liveData);
        }
      }
    } catch {
      // Retain state
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // 5. Status Transition Handler (SideSheet + Kanban Quick Move)
  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setDashboardData((prev) => {
      const updatedTasks: SchoolTask[] = prev.tasks.map((st) => {
        if (st.id === taskId) {
          const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
            newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
          return { ...st, status: schoolStatus };
        }
        const updatedSubs: StaffTask[] = st.subTasks.map((sub) =>
          sub.id === taskId ? { ...sub, status: newStatus } : sub
        );
        return { ...st, subTasks: updatedSubs };
      });

      const rolledUpTasks = updatedTasks.map((t) => computeSchoolTaskRollup(t));
      return {
        ...prev,
        tasks: rolledUpTasks,
        stats: computeDashboardStats(rolledUpTasks),
      };
    });

    setSelectedTask((prev) => {
      if (!prev || prev.id !== taskId) return prev;
      if (isSchoolTask(prev)) {
        const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
          newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
        return { ...prev, status: schoolStatus };
      }
      return { ...prev, status: newStatus };
    });
  };

  // 6. Handle Task Creation
  const handleCreateTask = (data: CreateTaskFormData) => {
    const todayStr = "2026-09-04";

    setDashboardData((prev) => {
      let updatedTasks = [...prev.tasks];

      if (data.level === "TRUONG") {
        const newTask: SchoolTask = {
          id: `task-${Date.now()}`,
          title: data.title,
          category: data.category,
          categoryLabel:
            CATEGORY_TABS.find((c) => c.id === data.category)?.label ||
            data.category,
          leadAssigneeName: data.leadAssigneeName,
          coAssignees: data.coAssignees,
          assignedDate: todayStr,
          dueDate: data.dueDate,
          status: "IN_PROGRESS",
          subTasks: [],
          totalSubTasks: 0,
          completedSubTasks: 0,
          progressPercent: 0,
        };
        updatedTasks.unshift(newTask);
      } else {
        const newSubTask: StaffTask = {
          id: `sub-${Date.now()}`,
          title: data.title,
          assigneeName: data.leadAssigneeName,
          status: "NEW",
          dueDate: data.dueDate,
          internalDueDate: data.internalDueDate,
          deliverableDescription: data.requiredDeliverables,
          vtvlRole: data.vtvlRole,
          requiresReview: data.requiresReview,
          parentSchoolTaskId:
            data.parentTaskId || updatedTasks[0]?.id || "task-1",
          updatedAt: todayStr,
        };

        if (data.parentTaskId) {
          updatedTasks = updatedTasks.map((st) => {
            if (st.id === data.parentTaskId) {
              return {
                ...st,
                subTasks: [newSubTask, ...st.subTasks],
              };
            }
            return st;
          });
        } else if (updatedTasks.length > 0) {
          updatedTasks[0] = {
            ...updatedTasks[0],
            subTasks: [newSubTask, ...updatedTasks[0].subTasks],
          };
        }
      }

      const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
      return {
        ...prev,
        tasks: rolledUp,
        stats: computeDashboardStats(rolledUp),
      };
    });
  };

  const openCreateModal = (level: TaskLevel, parentId?: string) => {
    setCreateInitialLevel(level);
    setCreateInitialParentId(parentId);
    setIsCreateModalOpen(true);
  };

  // Counts for quick stats
  const totalSchoolTasksCount = visibleTasks.length;
  const totalSubTasksCount = visibleTasks.reduce(
    (acc, t) => acc + (t.subTasks ? t.subTasks.length : 0),
    0
  );

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-5 pb-20 md:pb-10"
      data-slot="tasks-page"
    >
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link
          href="/"
          className="hover:text-foreground transition-colors"
        >
          Trang chủ
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground font-medium">
          Nhiệm vụ cấp Trường
        </span>
      </nav>

      {/* Header with Title and Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20 font-mono">
              Năm học 2025 - 2026
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              Học kỳ I
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
            Quản lý Nhiệm vụ Toàn trường
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Theo dõi tiến độ, phân cấp nhiệm vụ và phối hợp điều hành công việc toàn trường
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer disabled:opacity-60 shadow-2xs"
            title="Làm mới dữ liệu từ máy chủ"
          >
            <RefreshCw
              strokeWidth={1.5}
              className={cn(
                "size-3.5",
                isRefreshing ? "animate-spin text-foreground" : ""
              )}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateModal(user?.role === "ADMIN" ? "TRUONG" : "DON_VI")}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer shadow-2xs active:scale-95"
          >
            <Plus strokeWidth={1.5} className="size-3.5" />
            <span>
              {user?.role === "STAFF"
                ? "Tạo việc mới"
                : user?.role === "MANAGER"
                ? "Tạo việc / Giao việc"
                : "Giao việc mới"}
            </span>
          </button>
        </div>
      </div>

      {/* Filter Bar & View Mode Switcher */}
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-xs p-3 space-y-2.5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto thin-scrollbar pb-1 md:pb-0">
            {CATEGORY_TABS.map((tab: CategoryTab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={cn(
                    "whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Level Filter & View Mode Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Level Quick Filter */}
            <div className="hidden sm:flex items-center gap-1 border-r border-border/60 pr-2">
              <button
                type="button"
                onClick={() => setLevelFilter("ALL")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer font-mono tabular-nums",
                  levelFilter === "ALL"
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Tất cả ({totalSchoolTasksCount + totalSubTasksCount})
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter("TRUONG")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer font-mono tabular-nums",
                  levelFilter === "TRUONG"
                    ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Cấp Trường ({totalSchoolTasksCount})
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter("DON_VI")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer font-mono tabular-nums",
                  levelFilter === "DON_VI"
                    ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Đơn vị ({totalSubTasksCount})
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Xem dạng bảng phân cấp"
              >
                <List strokeWidth={1.5} className="size-3.5" />
                <span className="hidden sm:inline">Bảng</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "kanban"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Xem dạng bảng Kanban"
              >
                <LayoutGrid strokeWidth={1.5} className="size-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          <div className="relative flex-1">
            <Search
              strokeWidth={1.5}
              className="size-3.5 text-muted-foreground pointer-events-none absolute left-3 top-2.5"
            />
            <input
              type="text"
              placeholder="Tìm kiếm theo tiêu đề, người phụ trách hoặc công việc đơn vị..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-9 pr-8 rounded-lg border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Xóa tìm kiếm"
              >
                <X strokeWidth={1.5} className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Cascading Table OR Kanban Board */}
      <section aria-label="Danh sách công việc" className="min-h-[420px]">
        {viewMode === "table" ? (
          <CascadingTaskTable
            tasks={visibleTasks}
            onSelectTask={(task) => setSelectedTask(task)}
            onAddTask={() => openCreateModal("TRUONG")}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <TaskKanbanBoard
            tasks={visibleTasks}
            onSelectTask={(task) => setSelectedTask(task)}
            onStatusChange={handleStatusChange}
            onAddTask={(level, parentId) =>
              openCreateModal(level || "TRUONG", parentId)
            }
            levelFilter={levelFilter}
            categoryFilter={activeCategory}
            searchQuery={searchQuery}
          />
        )}
      </section>

      {/* TaskDetailSideSheet Slide-Over */}
      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={handleStatusChange}
        parentSchoolTaskTitle={parentSchoolTaskTitle}
      />

      {/* CreateTaskModal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
        schoolTasks={visibleTasks}
        initialLevel={createInitialLevel}
        initialParentTaskId={createInitialParentId}
      />
    </div>
  );
}
