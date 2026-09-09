"use client";

import * as React from "react";
import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  ChevronRight,
  RefreshCw,
  Plus,
  AlertCircle,
  Home,
  CheckSquare,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SchoolTask, StaffTask, DashboardPayload, TaskStatus, isSchoolTask } from "@/types/dashboard";
import {
  ExecutiveCalendarWorkspace,
  CalendarTimeEvent,
} from "@/components/calendar/executive-calendar-workspace";
import {
  CreateTaskModal,
  type CreateTaskFormData,
  type TaskLevel,
} from "@/components/dashboard/create-task-modal";
import {
  TaskDetailSideSheet,
} from "@/components/dashboard/task-detail-side-sheet";
import { useAuth } from "@/lib/auth-context";
import { computeSchoolTaskRollup, computeDashboardStats } from "@/lib/dashboard-aggregator";
import { cn } from "@/lib/utils";

function CalendarLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Đang tải lịch công tác">
      {/* Breadcrumb & Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div className="space-y-2.5">
          <div className="h-4 w-48 bg-muted/60 rounded" />
          <div className="h-8 w-72 bg-muted/80 rounded-lg" />
          <div className="h-4 w-96 bg-muted/50 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-muted/60 rounded-lg" />
          <div className="h-9 w-32 bg-muted/80 rounded-lg" />
        </div>
      </div>

      {/* Control Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/60 bg-card/60">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-muted/60 rounded-lg" />
          <div className="h-8 w-8 bg-muted/60 rounded-lg" />
          <div className="h-8 w-44 bg-muted/60 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-muted/60 rounded-lg" />
          <div className="h-8 w-24 bg-muted/60 rounded-lg" />
        </div>
      </div>

      {/* Week Grid Skeleton */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border/60 bg-muted/20">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-3 border-r border-border/40 last:border-r-0 space-y-1">
              <div className="h-3 w-10 bg-muted/50 rounded mx-auto" />
              <div className="h-4 w-6 bg-muted/70 rounded mx-auto" />
            </div>
          ))}
        </div>
        <div className="h-[460px] p-4 bg-card/30 flex items-center justify-center text-muted-foreground text-xs">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 animate-spin text-primary" />
            <span>Đang chuẩn bị lịch công tác và đồng bộ tiến độ nhiệm vụ...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarRouteContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // URL Query Parameters support: ?zone=calendar, ?date=YYYY-MM-DD, ?view=week_grid|agenda_list
  const zoneParam = searchParams?.get("zone") || "calendar";
  const dateParam = searchParams?.get("date") || undefined;
  const viewParam = searchParams?.get("view") === "agenda_list" ? "agenda_list" : "week_grid";

  const [tasks, setTasks] = useState<SchoolTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals and Side Sheet state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createInitialDueDate, setCreateInitialDueDate] = useState<string | undefined>(undefined);
  const [createInitialLevel, setCreateInitialLevel] = useState<TaskLevel>("TRUONG");

  const [selectedTask, setSelectedTask] = useState<SchoolTask | StaffTask | null>(null);

  useEffect(() => {
    document.title = "Lịch Công Tác BGH & Lịch Biểu | QCET E-Office";
  }, []);

  const loadTasksData = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const res = await fetch("/api/dashboard/overview");
      if (!res.ok) {
        throw new Error("Không thể tải danh sách nhiệm vụ từ máy chủ");
      }
      const data: DashboardPayload = await res.json();
      if (Array.isArray(data?.tasks)) {
        setTasks(data.tasks);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi khi kết nối dữ liệu lịch biểu";
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTasksData();
  }, [loadTasksData]);

  // Handle adding task from calendar slot
  const handleOpenAddTask = useCallback((dateStr?: string) => {
    setCreateInitialDueDate(dateStr);
    setCreateInitialLevel(user?.role === "ADMIN" ? "TRUONG" : "DON_VI");
    setIsCreateModalOpen(true);
  }, [user?.role]);

  // Handle selecting an event on the calendar
  const handleSelectEvent = useCallback((event: CalendarTimeEvent) => {
    if (event.taskId) {
      // Find matching school task or subtask
      for (const t of tasks) {
        if (t.id === event.taskId) {
          setSelectedTask(t);
          return;
        }
        if (t.subTasks) {
          const matchedSub = t.subTasks.find((st) => st.id === event.taskId);
          if (matchedSub) {
            setSelectedTask(matchedSub);
            return;
          }
        }
      }
    }
  }, [tasks]);

  // Handle task submission
  const handleCreateTaskSubmit = useCallback((data: CreateTaskFormData) => {
    setIsCreateModalOpen(false);
    const todayStr = new Date().toISOString().split("T")[0];

    setTasks((prevTasks) => {
      let updated = [...prevTasks];
      if (data.level === "TRUONG") {
        const newTask: SchoolTask = {
          id: `task-cal-${Date.now()}`,
          code: `NV-${todayStr.replace(/-/g, "").slice(2)}-${Math.floor(100 + Math.random() * 900)}`,
          title: data.title,
          category: data.category,
          categoryLabel: data.category,
          leadAssigneeName: data.leadAssigneeName,
          coAssignees: data.coAssignees || [],
          assignedDate: todayStr,
          dueDate: data.dueDate,
          totalSubTasks: 0,
          completedSubTasks: 0,
          status: "IN_PROGRESS",
          progressPercent: 0,
          subTasks: [],
        };
        updated = [newTask, ...updated];
      } else {
        const newSubTask: StaffTask = {
          id: `sub-cal-${Date.now()}`,
          title: data.title,
          assigneeName: data.leadAssigneeName,
          status: "NEW",
          dueDate: data.dueDate,
          internalDueDate: data.internalDueDate,
          deliverableDescription: data.requiredDeliverables,
          vtvlRole: data.vtvlRole,
          requiresReview: data.requiresReview,
          parentSchoolTaskId: data.parentTaskId || updated[0]?.id || "task-1",
          updatedAt: todayStr,
        };

        if (data.parentTaskId) {
          updated = updated.map((st) => {
            if (st.id === data.parentTaskId) {
              return {
                ...st,
                subTasks: [newSubTask, ...st.subTasks],
              };
            }
            return st;
          });
        } else if (updated.length > 0) {
          updated[0] = {
            ...updated[0],
            subTasks: [newSubTask, ...updated[0].subTasks],
          };
        }
      }

      return updated.map((t) => computeSchoolTaskRollup(t));
    });
  }, []);

  // Handle task status update
  const handleStatusChange = useCallback((taskId: string, newStatus: TaskStatus) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((st) => {
        if (st.id === taskId) {
          const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
            newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
          return { ...st, status: schoolStatus };
        }
        if (st.subTasks) {
          const hasSub = st.subTasks.some((sub) => sub.id === taskId);
          if (hasSub) {
            const updatedSubs = st.subTasks.map((sub) =>
              sub.id === taskId ? { ...sub, status: newStatus } : sub
            );
            return computeSchoolTaskRollup({ ...st, subTasks: updatedSubs });
          }
        }
        return st;
      });
      return updated;
    });

    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask((prev) => {
        if (!prev || prev.id !== taskId) return prev;
        if (isSchoolTask(prev)) {
          const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
            newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
          return { ...prev, status: schoolStatus };
        }
        return { ...prev, status: newStatus };
      });
    }
  }, [selectedTask]);

  return (
    <div className="space-y-6" data-zone={zoneParam}>
      <title>Lịch Công Tác BGH & Lịch Biểu | QCET E-Office</title>

      {/* Executive Page Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div className="space-y-1.5">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" />
              <span>Bàn làm việc</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="font-semibold text-foreground">Lịch Công Tác & Lịch Biểu BGH</span>
          </nav>

          {/* Heading and Executive Subtitle */}
          <div className="flex items-center gap-2.5 pt-0.5">
            <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Calendar className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
                Lịch Công Tác & Lịch Biểu BGH
              </h1>
              <p className="text-xs text-muted-foreground">
                Điều phối lịch công tác lãnh đạo, mốc nghiệm thu sản phẩm DACUM và tiến độ các đơn vị theo tuần
              </p>
            </div>
          </div>
        </div>

        {/* Global Route Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTasksData(true)}
            disabled={isRefreshing}
            className="h-9 gap-1.5 text-xs border-border/70 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
            <span>{isRefreshing ? "Đang đồng bộ..." : "Làm mới"}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenAddTask()}
            className="h-9 gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Thêm sự kiện / Nhiệm vụ</span>
          </Button>
        </div>
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center justify-between gap-3 text-destructive">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error} (hiển thị lịch mẫu tiêu chuẩn BGH)</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadTasksData()}
            className="h-7 text-xs border-destructive/30 hover:bg-destructive/10 text-destructive cursor-pointer"
          >
            Thử lại
          </Button>
        </div>
      )}

      {/* Main Executive Calendar Workspace */}
      {isLoading && tasks.length === 0 ? (
        <CalendarLoadingSkeleton />
      ) : (
        <ExecutiveCalendarWorkspace
          tasks={tasks}
          initialDate={dateParam}
          initialViewMode={viewParam}
          onAddTask={handleOpenAddTask}
          onSelectEvent={handleSelectEvent}
          isExecutive={user?.role === "ADMIN" || user?.role === "MANAGER"}
        />
      )}

      {/* Task Creation Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTaskSubmit}
        schoolTasks={tasks}
        initialLevel={createInitialLevel}
        initialDueDate={createInitialDueDate}
      />

      {/* Task Detail Side Sheet */}
      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={handleStatusChange}
        parentSchoolTaskTitle={
          selectedTask && !isSchoolTask(selectedTask) && "parentSchoolTaskId" in selectedTask && selectedTask.parentSchoolTaskId
            ? tasks.find((t) => t.id === (selectedTask as StaffTask).parentSchoolTaskId)?.title
            : undefined
        }
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarLoadingSkeleton />}>
      <CalendarRouteContent />
    </Suspense>
  );
}
