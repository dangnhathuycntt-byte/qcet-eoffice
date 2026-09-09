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
  CalendarWorkspace,
  ExecutiveCalendarWorkspace,
  CalendarEventDetailModal,
  type CalendarTimeEvent,
  type CalendarViewMode,
} from "@/components/calendar/calendar-workspace";
import type { WorkCalendarItem } from "@/lib/work-calendar-adapter";
import {
  CreateTaskModal,
  type CreateTaskFormData,
  type TaskLevel,
} from "@/components/dashboard/create-task-modal";
import {
  TaskDetailSideSheet,
} from "@/components/dashboard/task-detail-side-sheet";
import { useAuth } from "@/lib/auth-context";
import { getSystemReferenceDate } from "@/lib/academic-calendar";
import { computeSchoolTaskRollup } from "@/lib/dashboard-aggregator";
import { cn } from "@/lib/utils";

function CalendarLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Đang tải lịch công tác">
      {/* Breadcrumb & Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div className="space-y-2">
          <div className="h-4 w-48 bg-muted/60 rounded-md" />
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-muted/70" />
            <div className="space-y-1">
              <div className="h-6 w-64 bg-muted/70 rounded-md" />
              <div className="h-3.5 w-96 bg-muted/50 rounded-md" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-muted/60 rounded-lg" />
          <div className="h-9 w-36 bg-muted/70 rounded-lg" />
        </div>
      </div>

      {/* Control Bar & Filter Skeleton */}
      <div className="h-14 rounded-xl bg-muted/40 border border-border/60" />
      <div className="h-12 rounded-xl bg-muted/30 border border-border/50" />

      {/* Grid Layout Skeleton */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="h-12 bg-muted/40 border-b border-border/60" />
        <div className="grid grid-cols-7 divide-x divide-border/50 h-[480px]">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-2 space-y-2">
              <div className="h-4 w-12 bg-muted/50 rounded mx-auto" />
              <div className="h-16 w-full bg-muted/30 rounded-lg" />
              <div className="h-14 w-full bg-muted/20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarRouteContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // URL Query Parameters support: ?zone=calendar, ?date=YYYY-MM-DD, ?view=..., ?taskId=...
  const zoneParam = searchParams?.get("zone") || "calendar";
  const dateParam = searchParams?.get("date") || undefined;
  const initialViewParam = (searchParams?.get("view") as CalendarViewMode) || undefined;
  const taskIdParam = searchParams?.get("taskId") || undefined;

  const [tasks, setTasks] = useState<SchoolTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals and Side Sheet state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createInitialDueDate, setCreateInitialDueDate] = useState<string | undefined>(undefined);
  const [createInitialLevel, setCreateInitialLevel] = useState<TaskLevel>("TRUONG");

  // Selected task state for TaskDetailSideSheet
  const [selectedTask, setSelectedTask] = useState<SchoolTask | StaffTask | null>(null);

  // Selected non-task event for lightweight event modal
  const [selectedNonTaskEvent, setSelectedNonTaskEvent] = useState<CalendarTimeEvent | null>(null);

  useEffect(() => {
    document.title = "Lịch Công Tác BGH & Lịch Biểu | QCET E-Office";
  }, []);

  // Update URL search parameters without client-side redirect or reload
  const updateUrlParam = useCallback((key: string, value: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (value && value.trim()) {
      url.searchParams.set(key, value.trim());
    } else {
      url.searchParams.delete(key);
    }
    window.history.pushState(null, "", url.toString());
  }, []);

  const updateUrlTaskId = useCallback((taskId: string | null) => {
    updateUrlParam("taskId", taskId);
  }, [updateUrlParam]);

  const updateUrlDate = useCallback((dateStr: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("date", dateStr);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const updateUrlView = useCallback((viewMode: CalendarViewMode) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", viewMode);
    window.history.replaceState(null, "", url.toString());
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

  // Synchronize task selection from URL ?taskId=... on initial load and when tasks populate
  useEffect(() => {
    if (!taskIdParam || tasks.length === 0) return;

    // Find in school tasks
    const matchedSchool = tasks.find((t) => t.id === taskIdParam);
    if (matchedSchool) {
      setSelectedTask(matchedSchool);
      return;
    }

    // Find in subtasks
    for (const st of tasks) {
      if (st.subTasks) {
        const matchedSub = st.subTasks.find((sub) => sub.id === taskIdParam);
        if (matchedSub) {
          setSelectedTask(matchedSub);
          return;
        }
      }
    }
  }, [taskIdParam, tasks]);

  // Handle browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const currentUrl = new URL(window.location.href);
      const tid = currentUrl.searchParams.get("taskId");
      if (!tid) {
        setSelectedTask(null);
      } else if (tasks.length > 0) {
        const matchedSchool = tasks.find((t) => t.id === tid);
        if (matchedSchool) {
          setSelectedTask(matchedSchool);
          return;
        }
        for (const st of tasks) {
          if (st.subTasks) {
            const matchedSub = st.subTasks.find((sub) => sub.id === tid);
            if (matchedSub) {
              setSelectedTask(matchedSub);
              return;
            }
          }
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [tasks]);

  // Handle adding task from calendar slot
  const handleOpenAddTask = useCallback((dateStr?: string) => {
    setCreateInitialDueDate(dateStr);
    setCreateInitialLevel(user?.role === "ADMIN" ? "TRUONG" : "DON_VI");
    setIsCreateModalOpen(true);
  }, [user?.role]);

  // Select Task with URL synchronization
  const handleSelectTask = useCallback((task: SchoolTask | StaffTask) => {
    setSelectedTask(task);
    updateUrlTaskId(task.id);
  }, [updateUrlTaskId]);

  // Handle selecting a work calendar item (milestone, subtask, deliverable, backlog)
  const handleSelectWorkItem = useCallback((item: WorkCalendarItem) => {
    // 1. Direct school task match (by sourceTaskId, parentSchoolTaskId, or id prefix)
    const schoolTask = tasks.find(
      (t) => t.id === item.sourceTaskId || t.id === item.parentSchoolTaskId || `milestone-${t.id}` === item.id
    );
    if (schoolTask && (item.type === "school_milestone" || !item.parentSchoolTaskId || item.sourceTaskId === schoolTask.id)) {
      handleSelectTask(schoolTask);
      return;
    }

    // 2. Search for a subtask across all school tasks
    for (const st of tasks) {
      if (st.subTasks) {
        const matchedSub = st.subTasks.find((sub) => sub.id === item.sourceTaskId || sub.id === item.id);
        if (matchedSub) {
          handleSelectTask(matchedSub);
          return;
        }
      }
    }

    // 3. If parent school task exists, open parent school task
    if (schoolTask) {
      handleSelectTask(schoolTask);
      return;
    }

    // 4. Fallback: synthesize a task object so the side sheet can inspect item details
    const fallbackTask: StaffTask = {
      id: item.sourceTaskId || item.id,
      title: item.title,
      code: item.code,
      assigneeName: item.assigneeName,
      department: item.departmentName,
      assignedToDepartmentName: item.departmentName,
      departmentId: item.departmentId,
      status: item.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
      dueDate: item.dueDate,
      parentSchoolTaskId: item.parentSchoolTaskId,
      updatedAt: item.dueDate,
      deliverableDescription: item.deliverableSummary,
    };
    handleSelectTask(fallbackTask);
  }, [tasks, handleSelectTask]);

  // Handle selecting an event on the calendar
  const handleSelectEvent = useCallback((event: CalendarTimeEvent) => {
    if (event.workItem) {
      handleSelectWorkItem(event.workItem);
      return;
    }
    if (event.taskId) {
      for (const t of tasks) {
        if (t.id === event.taskId) {
          handleSelectTask(t);
          return;
        }
        if (t.subTasks) {
          const matchedSub = t.subTasks.find((st) => st.id === event.taskId);
          if (matchedSub) {
            handleSelectTask(matchedSub);
            return;
          }
        }
      }
    }

    // Non-task event -> open lightweight event modal
    setSelectedNonTaskEvent(event);
  }, [tasks, handleSelectWorkItem, handleSelectTask]);

  // Handle non-task event explicitly
  const handleSelectNonTaskEvent = useCallback((event: CalendarTimeEvent) => {
    setSelectedNonTaskEvent(event);
  }, []);

  // Handle close TaskDetailSideSheet
  const handleCloseSideSheet = useCallback(() => {
    setSelectedTask(null);
    updateUrlTaskId(null);
  }, [updateUrlTaskId]);

  // Handle task submission
  const handleCreateTaskSubmit = useCallback(async (data: CreateTaskFormData) => {
    setIsCreateModalOpen(false);

    // Optimistic UI state insertion
    const tempId = `task-created-${Date.now()}`;
    const cleanDueDate = data.dueDate ? `${data.dueDate}T17:00:00.000Z` : undefined;

    setTasks((prevTasks) => {
      const updated = [...prevTasks];

      if (data.level === "TRUONG") {
        const newSchoolTask: SchoolTask = {
          id: tempId,
          title: data.title,
          code: `NV-${new Date().getFullYear()}-${String(prevTasks.length + 1).padStart(2, "0")}`,
          taskCode: `NV-${new Date().getFullYear()}-${String(prevTasks.length + 1).padStart(2, "0")}`,
          category: data.category || "CNTT",
          categoryLabel: data.category || "Công nghệ thông tin",
          status: "IN_PROGRESS",
          dueDate: cleanDueDate || `${new Date().toISOString().split("T")[0]}T17:00:00.000Z`,
          progressPercent: 0,
          totalSubTasks: 0,
          completedSubTasks: 0,
          leadAssigneeName: user?.name || "Lãnh đạo phụ trách",
          assignedDate: new Date().toISOString().split("T")[0],
          coAssignees: [],
          subTasks: [],
        };
        updated.unshift(newSchoolTask);
      } else {
        const newSubTask: StaffTask = {
          id: tempId,
          taskId: data.parentTaskId || (updated[0]?.id ?? "task-root"),
          title: data.title,
          status: "IN_PROGRESS",
          dueDate: cleanDueDate || `${new Date().toISOString().split("T")[0]}T17:00:00.000Z`,
          assigneeName: user?.name || "Chuyên viên phụ trách",
          assignedToDepartmentId: user?.department || "BGH",
          assignedToDepartmentName: "Ban Giám hiệu",
          department: "Ban Giám hiệu",
          parentSchoolTaskId: data.parentTaskId || updated[0]?.id,
          updatedAt: new Date().toISOString(),
        };

        if (data.parentTaskId) {
          return updated.map((st) => {
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

    try {
      const payload = {
        title: data.title,
        description: data.description || data.requiredDeliverables || "",
        dueDate: data.dueDate,
        departmentId: user?.department || "BGH",
        scope: data.level === "TRUONG" ? "SCHOOL" : "DEPARTMENT",
        parentTaskId: data.parentTaskId || undefined,
        creatorId: user?.id,
      };

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn("Không thể lưu nhiệm vụ vào máy chủ:", await res.text().catch(() => ""));
      }
    } catch (err) {
      console.warn("Lỗi khi kết nối đến máy chủ để lưu nhiệm vụ:", err);
    }
  }, [user]);

  // Handle task status update
  const handleStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    // 1. Optimistic state update across school tasks and subtasks
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

    // 2. Asynchronous backend persistence
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.warn("Lỗi khi kết nối đến máy chủ để cập nhật trạng thái nhiệm vụ:", err);
    }
  }, [selectedTask]);

  return (
    <div className="space-y-6" data-zone={zoneParam}>
      {/* Executive Page Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div className="space-y-1.5">
          {/* Breadcrumb Navigation - Preserves Task Selection & Date Context */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" strokeWidth={1.5} />
              <span>Bàn làm việc</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" strokeWidth={1.5} />
            <Link
              href={selectedTask ? `/tasks?taskId=${selectedTask.id}` : "/tasks"}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              title="Xem trong Không gian Quản lý Nhiệm vụ"
            >
              <CheckSquare className="size-3.5" strokeWidth={1.5} />
              <span>Nhiệm vụ</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" strokeWidth={1.5} />
            <span className="font-semibold text-foreground">Lịch Công Tác & Lịch Biểu BGH</span>
          </nav>

          {/* Heading and Executive Subtitle */}
          <div className="flex items-center gap-2.5 pt-0.5">
            <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Calendar className="size-5" strokeWidth={1.5} />
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
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} strokeWidth={1.5} />
            <span>{isRefreshing ? "Đang đồng bộ..." : "Làm mới"}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenAddTask()}
            className="h-9 gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs cursor-pointer"
          >
            <Plus className="size-4" strokeWidth={1.5} />
            <span>Thêm sự kiện / Nhiệm vụ</span>
          </Button>
        </div>
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center justify-between gap-3 text-destructive">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="size-4 shrink-0" strokeWidth={1.5} />
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

      {/* Main Unified Calendar Workspace */}
      {isLoading && tasks.length === 0 ? (
        <CalendarLoadingSkeleton />
      ) : (
        <ExecutiveCalendarWorkspace
          tasks={tasks}
          initialDate={dateParam}
          initialViewMode={initialViewParam}
          onAddTask={handleOpenAddTask}
          onOpenAddTask={handleOpenAddTask}
          onSelectEvent={handleSelectEvent}
          onSelectWorkItem={handleSelectWorkItem}
          onSelectTask={handleSelectTask}
          onSelectNonTaskEvent={handleSelectNonTaskEvent}
          onDateChange={updateUrlDate}
          onViewChange={updateUrlView}
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

      {/* Unified Detail Surface: Task Detail Side Sheet */}
      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={handleCloseSideSheet}
        onStatusChange={handleStatusChange}
        currentUser={user || undefined}
        onSelectSubTask={(sub) => {
          if (typeof sub === "string") {
            for (const t of tasks) {
              const found = t.subTasks?.find((st) => st.id === sub);
              if (found) {
                handleSelectTask(found);
                return;
              }
            }
          } else {
            handleSelectTask(sub);
          }
        }}
        parentSchoolTaskTitle={
          selectedTask && !isSchoolTask(selectedTask) && "parentSchoolTaskId" in selectedTask && selectedTask.parentSchoolTaskId
            ? tasks.find((t) => t.id === (selectedTask as StaffTask).parentSchoolTaskId)?.title
            : undefined
        }
      />

      {/* Lightweight Event Detail Modal for Events without Tasks */}
      <CalendarEventDetailModal
        event={selectedNonTaskEvent}
        isOpen={Boolean(selectedNonTaskEvent)}
        onClose={() => setSelectedNonTaskEvent(null)}
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
