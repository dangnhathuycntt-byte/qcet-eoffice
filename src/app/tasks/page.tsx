"use client";

import * as React from "react";
import {
  SchoolTask,
  StaffTask,
  DashboardPayload,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import { getMockDashboardPayload } from "@/lib/mock-dashboard-data";
import { computeSchoolTaskRollup, computeDashboardStats } from "@/lib/dashboard-aggregator";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { filterTasksByRole } from "@/lib/role-task-filter";
import { RoleViewpointBanner } from "@/components/auth/role-viewpoint-banner";
import {
  LayoutGrid,
  List,
  Plus,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Building2,
  Users,
  CheckCircle2,
  Layers,
  X,
  Sparkles,
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

  // 2. View Mode & Filtering States
  const [viewMode, setViewMode] = React.useState<ViewMode>("kanban");
  const [activeCategory, setActiveCategory] = React.useState<TaskCategory | "ALL">("ALL");
  const [levelFilter, setLevelFilter] = React.useState<TaskLevelFilter>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");

  // 3. Create Task Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [createInitialLevel, setCreateInitialLevel] = React.useState<TaskLevel>("TRUONG");
  const [createInitialParentId, setCreateInitialParentId] = React.useState<string | undefined>(undefined);

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
            CATEGORY_TABS.find((c) => c.id === data.category)?.label || data.category,
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
          parentSchoolTaskId: data.parentTaskId || updatedTasks[0]?.id || "task-1",
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

  const openCreateModal = (level: TaskLevel = "TRUONG", parentId?: string) => {
    setCreateInitialLevel(level);
    setCreateInitialParentId(parentId);
    setIsCreateModalOpen(true);
  };

  // Summary counts based on active role viewpoint
  const totalSchoolTasksCount = visibleTasks.length;
  const totalSubTasksCount = visibleTasks.reduce(
    (acc, st) => acc + (st.subTasks?.length || 0),
    0
  );

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10"
      data-slot="twenty-tasks-page"
    >
      {/* ========================================================================= */}
      {/* 1. Page Header with QCET Badge, Bold Title, and Actions                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <Building2 className="size-3" />
              <span>VĂN PHÒNG ĐIỀU HÀNH QCET</span>
            </span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              • Quản lý Nhiệm vụ cấp Trường
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <span>Danh mục & Bảng điều phối nhiệm vụ</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Theo dõi tiến độ, phân công và xử lý công việc đa cấp độ theo chuẩn Twenty CRM
          </p>
        </div>

        {/* Action Controls: View Switcher, Refresh & + Giao việc */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                viewMode === "table"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Xem dạng Bảng phân cấp"
            >
              <List className="size-3.5" />
              <span>Bảng phân cấp</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                viewMode === "kanban"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Xem dạng Bảng Kanban"
            >
              <LayoutGrid className="size-3.5" />
              <span>Bảng Kanban</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer disabled:opacity-60 shadow-2xs"
            title="Làm mới dữ liệu"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? "animate-spin text-foreground" : ""}`}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          {/* + Giao việc Primary Button */}
          <Button
            type="button"
            onClick={() => openCreateModal("TRUONG")}
            className="h-8.5 gap-1.5 px-3.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-card hover:shadow-card-hover transition-all cursor-pointer rounded-lg"
          >
            <Plus className="size-3.5" />
            <span>+ Giao việc</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Role Viewpoint Banner (RBAC Real-time Scope Indicator)                */}
      {/* ========================================================================= */}
      <section aria-label="Góc nhìn vai trò">
        <RoleViewpointBanner />
      </section>

      {/* ========================================================================= */}
      {/* 3. Global Filter & Search Toolbar                                        */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xs p-3.5 shadow-card">
        {/* Category Tabs / Pills */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <div className="flex items-center gap-1.5">
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition-all cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Task Level Quick Filter (All / School / Unit) */}
          <div className="hidden lg:flex items-center gap-1 border-l border-border/60 pl-3">
            <button
              type="button"
              onClick={() => setLevelFilter("ALL")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
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
                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                levelFilter === "TRUONG"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Cấp Trường ({totalSchoolTasksCount})
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter("DON_VI")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                levelFilter === "DON_VI"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Đơn vị ({totalSubTasksCount})
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <div className="relative flex-1">
            <Search className="size-3.5 text-muted-foreground pointer-events-none absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tiêu đề, người thực hiện hoặc công việc đơn vị (⌘K)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8.5 pl-9 pr-8 rounded-xl border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Xóa tìm kiếm"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. Main Content: Cascading Table OR Kanban Board                         */}
      {/* ========================================================================= */}
      {viewMode === "table" ? (
        <CascadingTaskTable
          tasks={visibleTasks}
          onSelectTask={(task) => setSelectedTask(task)}
          onAddTask={() => openCreateModal("TRUONG")}
        />
      ) : (
        <TaskKanbanBoard
          tasks={visibleTasks}
          onSelectTask={(task) => setSelectedTask(task)}
          onStatusChange={handleStatusChange}
          onAddTask={(level, parentId) => openCreateModal(level || "TRUONG", parentId)}
          levelFilter={levelFilter}
          categoryFilter={activeCategory}
          searchQuery={searchQuery}
        />
      )}

      {/* ========================================================================= */}
      {/* 5. TaskDetailSideSheet Slide-Over                                        */}
      {/* ========================================================================= */}
      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={handleStatusChange}
      />

      {/* ========================================================================= */}
      {/* 6. CreateTaskModal                                                       */}
      {/* ========================================================================= */}
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
