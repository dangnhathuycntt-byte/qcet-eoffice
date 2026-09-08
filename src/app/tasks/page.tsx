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
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "table" | "kanban";

export default function TasksPage() {
  const { user } = useAuth();

  const [dashboardData, setDashboardData] = React.useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedTask, setSelectedTask] = React.useState<
    SchoolTask | StaffTask | null
  >(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // View Mode & Filtering States
  const [viewMode, setViewMode] = React.useState<ViewMode>("kanban");
  const [activeCategory, setActiveCategory] = React.useState<
    TaskCategory | "ALL"
  >("ALL");
  const [levelFilter, setLevelFilter] = React.useState<TaskLevelFilter>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Create Task Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [createInitialLevel, setCreateInitialLevel] =
    React.useState<TaskLevel>("TRUONG");
  const [createInitialParentId, setCreateInitialParentId] = React.useState<
    string | undefined
  >(undefined);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (!response.ok) {
        throw new Error("Không thể kết nối đến máy chủ danh sách công việc");
      }
      const liveData: DashboardPayload = await response.json();
      if (liveData?.tasks) {
        setDashboardData(liveData);
      } else {
        throw new Error("Dữ liệu nhận được từ máy chủ không hợp lệ");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải dữ liệu công việc";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (response.ok) {
        const liveData: DashboardPayload = await response.json();
        if (liveData?.tasks) {
          setDashboardData(liveData);
          setError(null);
        }
      }
    } catch {
      // Retain state
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Filter tasks dynamically by active role viewpoint
  const visibleTasks = React.useMemo(
    () => (dashboardData ? filterTasksByRole(dashboardData.tasks, user) : []),
    [dashboardData, user]
  );

  const parentSchoolTaskTitle = React.useMemo(() => {
    if (!selectedTask || isSchoolTask(selectedTask) || !dashboardData) return undefined;
    const parent = dashboardData.tasks.find(
      (t) => t.id === selectedTask.parentSchoolTaskId
    );
    return parent?.title;
  }, [selectedTask, dashboardData]);

  // Status Transition Handler (SideSheet + Kanban Quick Move)
  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setDashboardData((prev) => {
      if (!prev) return prev;
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

  // Handle Task Creation
  const handleCreateTask = (data: CreateTaskFormData) => {
    const todayStr = new Date().toISOString().split("T")[0];

    setDashboardData((prev) => {
      if (!prev) return prev;
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

  // Error State
  if (error && !dashboardData) {
    return (
      <div className="max-w-[1440px] w-full mx-auto py-12 px-4">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center max-w-md mx-auto space-y-4">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="size-6" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground font-heading">
              Không thể tải danh sách công việc
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-1.5 text-xs font-medium"
          >
            <RefreshCw className="size-3.5" strokeWidth={1.5} />
            <span>Thử lại</span>
          </Button>
        </div>
      </div>
    );
  }

  // Loading Skeleton State
  if (isLoading && !dashboardData) {
    return (
      <div
        className="max-w-[1440px] w-full mx-auto space-y-4 pb-24 md:pb-10 animate-pulse"
        aria-label="Đang nạp dữ liệu công việc..."
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-muted/60" />
            <div className="h-7 w-56 rounded-md bg-muted/80" />
            <div className="h-4 w-80 max-w-full rounded bg-muted/50" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8.5 w-32 rounded-lg bg-muted/60 border border-border/60" />
            <div className="h-8.5 w-24 rounded-lg bg-muted/60 border border-border/60" />
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-7 w-20 rounded-md bg-muted/50 shrink-0" />
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-6 w-44 rounded-md bg-muted/40 border border-border/50" />
              <div className="h-7 w-24 rounded-lg bg-muted/50 border border-border/60" />
            </div>
          </div>
          <div className="pt-2 border-t border-border/40">
            <div className="h-8 w-full rounded-lg bg-muted/30 border border-border/50" />
          </div>
        </div>

        <section className="min-h-[420px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((col) => (
              <div
                key={col}
                className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3 min-h-[380px]"
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="h-4 w-28 rounded bg-muted/70" />
                  <div className="size-5 rounded-full bg-muted/50" />
                </div>
                <div className="space-y-2.5">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="rounded-lg border border-border/60 bg-card p-3 space-y-2 shadow-2xs"
                    >
                      <div className="h-4 w-3/4 rounded bg-muted/70" />
                      <div className="h-3 w-1/2 rounded bg-muted/40" />
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="size-6 rounded-full bg-muted/50" />
                        <div className="h-3 w-16 rounded bg-muted/40" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

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
