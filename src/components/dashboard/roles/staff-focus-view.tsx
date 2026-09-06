"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Upload,
  Calendar,
  Search,
  ArrowRight,
  FolderOpen,
  FileText,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import type {
  SchoolTask,
  StaffTask,
  TaskStatus,
} from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { matchesUser } from "@/lib/role-task-filter";
import { cn } from "@/lib/utils";

// -- Types & Exported Interfaces ---------------------------------------------

export interface StaffTaskWithContext extends StaffTask {
  parentSchoolTaskId: string;
  parentTaskTitle: string;
  parentTaskCategory?: string;
  parentCategoryLabel?: string;
}

export interface CategorizedStaffTasks {
  urgentToday: StaffTaskWithContext[];
  thisWeek: StaffTaskWithContext[];
  awaitingReview: StaffTaskWithContext[];
  completed: StaffTaskWithContext[];
  all: StaffTaskWithContext[];
}

export interface StaffHeroStats {
  totalPending: number;
  urgentTodayCount: number;
  awaitingReviewCount: number;
  completedCount: number;
}

export interface StaffFocusViewProps {
  tasks: SchoolTask[];
  user: AuthUser;
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus, note?: string) => void;
  onOpenSubmitModal?: (task: StaffTask) => void;
  todayDate?: string;
  className?: string;
}

export type StaffFilterTab = "ALL" | "URGENT" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";

// -- Helper Functions --------------------------------------------------------

/**
 * Extracts all subtasks assigned to the given staff user, enriched with parent school task context.
 */
export function extractStaffTasks(
  tasks: SchoolTask[],
  user: AuthUser
): StaffTaskWithContext[] {
  if (!tasks || tasks.length === 0 || !user) return [];

  const results: StaffTaskWithContext[] = [];

  for (const schoolTask of tasks) {
    if (!schoolTask.subTasks || schoolTask.subTasks.length === 0) continue;

    for (const sub of schoolTask.subTasks) {
      const isAssignedToUser =
        (sub.assigneeId && sub.assigneeId === user.id) ||
        matchesUser(sub.assigneeName, user);

      if (isAssignedToUser) {
        results.push({
          ...sub,
          parentSchoolTaskId: schoolTask.id,
          parentTaskTitle: schoolTask.title,
          parentTaskCategory: schoolTask.category,
          parentCategoryLabel: schoolTask.categoryLabel,
        });
      }
    }
  }

  return results;
}

/**
 * Categorizes staff tasks into three distinct operational tiers plus completed tasks.
 * Tier 1: Urgent & Today (Overdue or Due Today, or Blocked)
 * Tier 2: Sắp tới hạn (Due in next 7 days, or upcoming)
 * Tier 3: Đang chờ duyệt (status: NEEDS_REVIEW)
 */
export function categorizeStaffTasks(
  staffTasks: StaffTaskWithContext[],
  referenceDate?: string
): CategorizedStaffTasks {
  const refDate = referenceDate || new Date().toISOString().slice(0, 10);

  // Compute 7 days after reference date (YYYY-MM-DD)
  const refDateObj = new Date(refDate + "T00:00:00Z");
  const sevenDaysLaterObj = new Date(refDateObj);
  sevenDaysLaterObj.setUTCDate(sevenDaysLaterObj.getUTCDate() + 7);
  const sevenDaysLaterStr = sevenDaysLaterObj.toISOString().slice(0, 10);

  const urgentToday: StaffTaskWithContext[] = [];
  const thisWeek: StaffTaskWithContext[] = [];
  const awaitingReview: StaffTaskWithContext[] = [];
  const completed: StaffTaskWithContext[] = [];

  for (const task of staffTasks) {
    if (task.status === "COMPLETED") {
      completed.push(task);
      continue;
    }

    if (task.status === "NEEDS_REVIEW") {
      awaitingReview.push(task);
      continue;
    }

    const taskDueDate = task.dueDate ? task.dueDate.slice(0, 10) : "";

    // Tier 1: Overdue, due today, or blocked
    if (!taskDueDate || taskDueDate <= refDate || task.status === "BLOCKED") {
      urgentToday.push(task);
    } else if (taskDueDate <= sevenDaysLaterStr) {
      // Tier 2: Due within the next 7 days
      thisWeek.push(task);
    } else {
      // Later upcoming tasks also bucketed in upcoming queue
      thisWeek.push(task);
    }
  }

  // Sort urgentToday: earliest due date first
  urgentToday.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  thisWeek.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  awaitingReview.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  completed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    urgentToday,
    thisWeek,
    awaitingReview,
    completed,
    all: staffTasks,
  };
}

/**
 * Computes summary figures for the Staff Daily Hero Card.
 */
export function getStaffHeroStats(
  categorized: CategorizedStaffTasks
): StaffHeroStats {
  return {
    totalPending: categorized.urgentToday.length + categorized.thisWeek.length,
    urgentTodayCount: categorized.urgentToday.length,
    awaitingReviewCount: categorized.awaitingReview.length,
    completedCount: categorized.completed.length,
  };
}

/**
 * Formats YYYY-MM-DD date string into Vietnamese DD/MM/YYYY.
 */
function formatDateVN(dateStr?: string): string {
  if (!dateStr) return "--";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// -- Category & Status Styling Helpers ----------------------------------------

const CATEGORY_STYLES: Record<string, { label: string; badgeClass: string }> = {
  CHUYEN_DOI_SO: {
    label: "Chuyển đổi số",
    badgeClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
  },
  TRUYEN_THONG: {
    label: "Truyền thông",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  },
  CNTT: {
    label: "CNTT",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  ATTT: {
    label: "An toàn thông tin",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  THU_VIEN: {
    label: "Thư viện",
    badgeClass: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
  },
  BAO_CAO: {
    label: "Báo cáo",
    badgeClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
  },
  KHAC: {
    label: "Khác",
    badgeClass: "bg-neutral-500/10 text-neutral-700 dark:text-neutral-400 border-neutral-500/20",
  },
};

function getCategoryInfo(code?: string, defaultLabel?: string) {
  if (code && CATEGORY_STYLES[code]) {
    return CATEGORY_STYLES[code];
  }
  return {
    label: defaultLabel || code || "Nhiệm vụ",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
  };
}

// -- Main Component -----------------------------------------------------------

export function StaffFocusView({
  tasks,
  user,
  onSelectTask,
  onStatusChange,
  onOpenSubmitModal,
  todayDate,
  className,
}: StaffFocusViewProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<StaffFilterTab>("ALL");

  const effectiveRefDate = React.useMemo(
    () => todayDate || new Date().toISOString().slice(0, 10),
    [todayDate]
  );

  // Extract staff tasks from incoming school tasks
  const staffTasks = React.useMemo(
    () => extractStaffTasks(tasks, user),
    [tasks, user]
  );

  // Categorize tasks into 3 operational tiers + completed
  const categorized = React.useMemo(
    () => categorizeStaffTasks(staffTasks, effectiveRefDate),
    [staffTasks, effectiveRefDate]
  );

  const stats = React.useMemo(
    () => getStaffHeroStats(categorized),
    [categorized]
  );

  // Filter tasks based on search query
  const query = searchQuery.trim().toLowerCase();
  const filterByQuery = (taskList: StaffTaskWithContext[]) => {
    if (!query) return taskList;
    return taskList.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.parentTaskTitle.toLowerCase().includes(query) ||
        (t.deliverableDescription && t.deliverableDescription.toLowerCase().includes(query))
    );
  };

  const filteredUrgent = filterByQuery(categorized.urgentToday);
  const filteredThisWeek = filterByQuery(categorized.thisWeek);
  const filteredReview = filterByQuery(categorized.awaitingReview);
  const filteredCompleted = filterByQuery(categorized.completed);

  // Handler for 1-click submit
  const handleQuickSubmit = (task: StaffTaskWithContext) => {
    if (onOpenSubmitModal) {
      onOpenSubmitModal(task);
    } else {
      onSelectTask(task);
    }
  };

  // Top CTA action: submit primary urgent task or first pending task
  const handlePrimaryHeroAction = () => {
    const primaryTask =
      categorized.urgentToday[0] ||
      categorized.thisWeek[0] ||
      categorized.all[0];
    if (primaryTask) {
      handleQuickSubmit(primaryTask);
    }
  };

  // If user has zero tasks in system
  if (staffTasks.length === 0) {
    return (
      <div className={cn("space-y-6", className)}>
        {/* Daily Hero Banner */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="font-heading font-bold text-xl sm:text-2xl text-foreground tracking-tight">
                Chào {user.name}, hôm nay bạn không có việc tồn đọng
              </h1>
              <p className="text-sm text-muted-foreground">
                Không gian làm việc tập trung (My Focus) · {user.department || "Đơn vị"}
              </p>
            </div>
          </div>
        </div>

        {/* Positive Empty State */}
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4">
            <CheckCircle2 className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <h3 className="font-heading font-bold text-lg text-foreground mb-1">
            Chưa có nhiệm vụ được phân công
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Hiện tại bạn không có nhiệm vụ nào cần thực hiện. Khi có nhiệm vụ mới từ Trưởng đơn vị hoặc Nhà trường, các công việc sẽ xuất hiện tại đây.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* 1. Daily Hero Card */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium border border-primary/20 bg-primary/5 text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>Không gian Làm việc Tập trung (My Focus)</span>
            </div>

            <h1 className="font-heading font-bold text-xl sm:text-2xl text-foreground tracking-tight">
              Chào {user.name}, hôm nay bạn có{" "}
              <span className="font-mono tabular-nums font-bold text-primary">
                {stats.totalPending}
              </span>{" "}
              việc cần hoàn thành
            </h1>

            <p className="text-sm text-muted-foreground">
              {user.roleLabel || user.department} · Cập nhật theo thời gian thực
            </p>

            {/* Metric Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Urgent Pill */}
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  stats.urgentTodayCount > 0
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold"
                    : "border-border bg-muted/30 text-muted-foreground"
                )}
              >
                <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>Quá hạn &amp; Hôm nay:</span>
                <span className="font-mono tabular-nums font-bold">
                  {stats.urgentTodayCount}
                </span>
              </div>

              {/* Waiting Pill */}
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  stats.awaitingReviewCount > 0
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                    : "border-border bg-muted/30 text-muted-foreground"
                )}
              >
                <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>Đang chờ duyệt:</span>
                <span className="font-mono tabular-nums font-bold">
                  {stats.awaitingReviewCount}
                </span>
              </div>

              {/* Completed Pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>Hoàn thành:</span>
                <span className="font-mono tabular-nums font-bold">
                  {stats.completedCount}
                </span>
              </div>
            </div>
          </div>

          {/* Quick CTA Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePrimaryHeroAction}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Upload className="h-4 w-4" strokeWidth={1.5} />
              <span>Báo cáo tiến độ / Nộp minh chứng</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar: Search + Quick Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Tabs */}
        <div className="inline-flex rounded-lg border border-border bg-card p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors",
              activeTab === "ALL"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Tất cả (
            <span className="font-mono tabular-nums">{staffTasks.length}</span>)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("URGENT")}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors",
              activeTab === "URGENT"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Cần xử lý (
            <span className="font-mono tabular-nums">{stats.urgentTodayCount}</span>)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("IN_PROGRESS")}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors",
              activeTab === "IN_PROGRESS"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sắp tới hạn (
            <span className="font-mono tabular-nums">{categorized.thisWeek.length}</span>)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("REVIEW")}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors",
              activeTab === "REVIEW"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Chờ duyệt (
            <span className="font-mono tabular-nums">{stats.awaitingReviewCount}</span>)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("COMPLETED")}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors",
              activeTab === "COMPLETED"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Đã xong (
            <span className="font-mono tabular-nums">{stats.completedCount}</span>)
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Tìm theo tên việc, minh chứng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* 2. 3-Tier Task List */}
      <div className="space-y-8">
        {/* TIER 1: Khẩn cấp & Hôm nay */}
        {(activeTab === "ALL" || activeTab === "URGENT") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <h2 className="font-heading font-bold text-base text-foreground tracking-tight">
                  Khẩn cấp &amp; Hôm nay (Cần xử lý ngay)
                </h2>
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                  {filteredUrgent.length}
                </span>
              </div>
            </div>

            {filteredUrgent.length === 0 ? (
              <div className="rounded-lg border border-border bg-card/60 p-5 text-center flex items-center justify-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.5} />
                <span className="text-sm text-muted-foreground">
                  Tuyệt vời! Không có nhiệm vụ nào quá hạn hoặc cần làm gấp hôm nay.
                </span>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredUrgent.map((task) => (
                  <TaskActionCard
                    key={task.id}
                    task={task}
                    tier="URGENT"
                    referenceDate={effectiveRefDate}
                    onSelectTask={onSelectTask}
                    onStatusChange={onStatusChange}
                    onQuickSubmit={handleQuickSubmit}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TIER 2: Sắp tới hạn (Trong tuần này) */}
        {(activeTab === "ALL" || activeTab === "IN_PROGRESS") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Clock className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <h2 className="font-heading font-bold text-base text-foreground tracking-tight">
                  Sắp tới hạn (Trong tuần này)
                </h2>
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                  {filteredThisWeek.length}
                </span>
              </div>
            </div>

            {filteredThisWeek.length === 0 ? (
              <div className="rounded-lg border border-border bg-card/60 p-5 text-center text-sm text-muted-foreground">
                Không có nhiệm vụ sắp tới hạn trong tuần này.
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredThisWeek.map((task) => (
                  <TaskActionCard
                    key={task.id}
                    task={task}
                    tier="THIS_WEEK"
                    referenceDate={effectiveRefDate}
                    onSelectTask={onSelectTask}
                    onStatusChange={onStatusChange}
                    onQuickSubmit={handleQuickSubmit}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TIER 3: Đang chờ duyệt (Submitted / Awaiting Approval) */}
        {(activeTab === "ALL" || activeTab === "REVIEW") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <FileCheck className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <h2 className="font-heading font-bold text-base text-foreground tracking-tight">
                  Đang chờ duyệt (Đã nộp chờ duyệt)
                </h2>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                  {filteredReview.length}
                </span>
              </div>
            </div>

            {filteredReview.length === 0 ? (
              <div className="rounded-lg border border-border bg-card/60 p-5 text-center text-sm text-muted-foreground">
                Không có hồ sơ nào đang chờ duyệt.
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredReview.map((task) => (
                  <TaskActionCard
                    key={task.id}
                    task={task}
                    tier="REVIEW"
                    referenceDate={effectiveRefDate}
                    onSelectTask={onSelectTask}
                    onStatusChange={onStatusChange}
                    onQuickSubmit={handleQuickSubmit}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* COMPLETED TAB or ALL VIEW */}
        {(activeTab === "COMPLETED" || (activeTab === "ALL" && filteredCompleted.length > 0)) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <h2 className="font-heading font-bold text-base text-foreground tracking-tight">
                  Đã hoàn thành gần đây
                </h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                  {filteredCompleted.length}
                </span>
              </div>
            </div>

            <div className="grid gap-3">
              {filteredCompleted.map((task) => (
                <TaskActionCard
                  key={task.id}
                  task={task}
                  tier="COMPLETED"
                  referenceDate={effectiveRefDate}
                  onSelectTask={onSelectTask}
                  onStatusChange={onStatusChange}
                  onQuickSubmit={handleQuickSubmit}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -- Action-Centric Task Card Component --------------------------------------

interface TaskActionCardProps {
  task: StaffTaskWithContext;
  tier: "URGENT" | "THIS_WEEK" | "REVIEW" | "COMPLETED";
  referenceDate: string;
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus, note?: string) => void;
  onQuickSubmit: (task: StaffTaskWithContext) => void;
}

function TaskActionCard({
  task,
  tier,
  referenceDate,
  onSelectTask,
  onStatusChange,
  onQuickSubmit,
}: TaskActionCardProps) {
  const isOverdue = task.dueDate && task.dueDate.slice(0, 10) < referenceDate;
  const isDueToday = task.dueDate && task.dueDate.slice(0, 10) === referenceDate;
  const categoryInfo = getCategoryInfo(task.parentTaskCategory, task.parentCategoryLabel);

  return (
    <div
      className={cn(
        "group relative rounded-xl border p-4 transition-all duration-150",
        tier === "URGENT"
          ? "border-rose-500/40 bg-rose-500/[0.02] hover:border-rose-500 hover:bg-rose-500/[0.04]"
          : tier === "REVIEW"
          ? "border-amber-500/30 bg-amber-500/[0.02] hover:border-amber-500 hover:bg-amber-500/[0.04]"
          : tier === "COMPLETED"
          ? "border-emerald-500/30 bg-card/60 opacity-80 hover:opacity-100"
          : "border-border bg-card hover:border-primary/50"
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left Side: Context, Title, Badges */}
        <div className="space-y-1.5 min-w-0 flex-1">
          {/* Parent school task tag */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-md border font-medium text-[11px]",
                categoryInfo.badgeClass
              )}
            >
              {categoryInfo.label}
            </span>

            <span className="text-muted-foreground truncate max-w-xs md:max-w-md">
              Cấp trường: {task.parentTaskTitle}
            </span>
          </div>

          {/* Task Title */}
          <h3
            onClick={() => onSelectTask(task)}
            className="font-medium text-sm text-foreground hover:text-primary cursor-pointer transition-colors line-clamp-2"
          >
            {task.title}
          </h3>

          {/* Meta Info: Due date, Deliverables, Status */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
            {/* Due date with tabular-nums */}
            <div
              className={cn(
                "inline-flex items-center gap-1.5 font-mono tabular-nums",
                isOverdue && tier !== "COMPLETED"
                  ? "text-rose-600 dark:text-rose-400 font-semibold"
                  : isDueToday && tier !== "COMPLETED"
                  ? "text-amber-600 dark:text-amber-400 font-semibold"
                  : "text-muted-foreground"
              )}
            >
              <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>
                {isOverdue && tier !== "COMPLETED"
                  ? "Quá hạn: "
                  : isDueToday && tier !== "COMPLETED"
                  ? "Hôm nay: "
                  : "Hạn: "}
                {formatDateVN(task.dueDate)}
              </span>
            </div>

            {/* Deliverables summary */}
            {task.deliverables && task.deliverables.length > 0 && (
              <div className="inline-flex items-center gap-1 font-mono tabular-nums text-primary">
                <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>
                  {task.deliverables.length} minh chứng
                </span>
              </div>
            )}

            {/* Deliverable description preview */}
            {task.deliverableDescription && !task.deliverables?.length && (
              <span className="text-muted-foreground italic truncate max-w-xs">
                Yêu cầu: {task.deliverableDescription}
              </span>
            )}

            {/* In Review badge */}
            {task.status === "NEEDS_REVIEW" && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium font-mono tabular-nums">
                <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                Đang chờ duyệt
              </span>
            )}

            {/* Completed badge */}
            {task.status === "COMPLETED" && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium font-mono tabular-nums">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Đã hoàn tất
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 pt-2 md:pt-0 shrink-0">
          {tier !== "COMPLETED" && tier !== "REVIEW" && (
            <button
              type="button"
              onClick={() => onQuickSubmit(task)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors shadow-2xs",
                tier === "URGENT"
                  ? "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 font-semibold"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Nộp minh chứng</span>
            </button>
          )}

          {tier === "REVIEW" && (
            <button
              type="button"
              onClick={() => onSelectTask(task)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              <FileCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Xem minh chứng</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelectTask(task)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Xem chi tiết nhiệm vụ"
          >
            <span>Chi tiết</span>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
