"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar as CalendarIcon,
  Bell,
  ChevronRight,
  ArrowRight,
  MapPin,
  FileText,
  Building2,
  Layers,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SchoolTask, StaffTask, DashboardStats, ActivityEvent } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type { ExecutiveActionStats } from "@/lib/executive-matrix-aggregator";
import {
  useOptionalDashboardData,
  useDashboardModal,
} from "@/components/dashboard/dashboard-context";
import { getSystemReferenceDate } from "@/lib/academic-calendar";

export interface WorkbenchMobileScheduleItem {
  id: string;
  time: string;
  title: string;
  location: string;
}

export interface WorkbenchMobileNoticeItem {
  id: string;
  title: string;
  timeAgo: string;
  sender?: string;
  href?: string;
}

export interface WorkbenchMobileFeedProps {
  user?: AuthUser | null;
  role?: "EXECUTIVE" | "ADMIN" | "MANAGER" | "STAFF" | "TEACHER" | string;
  isExecutive?: boolean;
  isManager?: boolean;
  isStaff?: boolean;
  stats?: DashboardStats;
  executiveStats?: ExecutiveActionStats | null;
  tasks?: SchoolTask[];
  urgentTasks?: (SchoolTask | StaffTask)[];
  keyTasks?: SchoolTask[];
  scheduleItems?: WorkbenchMobileScheduleItem[];
  notices?: WorkbenchMobileNoticeItem[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  className?: string;
  referenceDate?: string | Date;
}

/**
 * Định dạng thứ và ngày trong tuần theo chuẩn hành chính Việt Nam.
 * Ví dụ: "Thứ Tư, ngày 09/09/2026"
 */
export function formatVietnameseCurrentDate(dateInput?: string | Date): string {
  const refStr =
    typeof dateInput === "string"
      ? dateInput.split("T")[0]
      : dateInput instanceof Date
      ? dateInput.toISOString().split("T")[0]
      : getSystemReferenceDate();

  try {
    const [yearStr, monthStr, dayStr] = refStr.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    const dt = new Date(year, month - 1, day);
    const dayOfWeekIndex = dt.getDay(); // 0 = Chủ Nhật, 1 = Thứ Hai, ...
    const days = [
      "Chủ Nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];
    const dayName = days[dayOfWeekIndex] || "Thứ Tư";
    const formattedDay = String(day).padStart(2, "0");
    const formattedMonth = String(month).padStart(2, "0");

    return `${dayName}, ngày ${formattedDay}/${formattedMonth}/${year}`;
  } catch {
    return "Thứ Tư, ngày 09/09/2026";
  }
}

/**
 * Tạo câu chào chuyên nghiệp, tôn kính theo thời gian trong ngày và chuẩn giao tiếp học đường.
 */
export function getAcademicGreeting(userName?: string | null): string {
  // Chuẩn thời gian buổi sáng/chiều/tối
  const now = new Date();
  const hour = now.getHours();

  let timeGreeting = "Chào buổi sáng";
  if (hour >= 12 && hour < 18) {
    timeGreeting = "Chào buổi chiều";
  } else if (hour >= 18) {
    timeGreeting = "Chào buổi tối";
  }

  if (userName && userName.trim().length > 0) {
    return `${timeGreeting}, Thầy/Cô ${userName.trim()}`;
  }
  return `${timeGreeting}, Thầy/Cô`;
}

/**
 * Xác định nhãn phân cấp vai trò hiển thị nhanh dạng chip
 */
export function getRoleChipLabel(
  isExec?: boolean,
  isMgr?: boolean,
  department?: string
): string {
  if (isExec) return "Ban Giám hiệu";
  if (isMgr) return department ? `Lãnh đạo ${department}` : "Lãnh đạo đơn vị";
  return "Cán bộ / Giảng viên";
}

/**
 * Định dạng ngày đến hạn ngắn gọn: "Hạn 15/09" hoặc "Hạn hôm nay"
 */
export function formatShortDueDate(
  dueDate?: string | null,
  referenceDateInput?: string | Date
): { text: string; isOverdue: boolean; isToday: boolean } {
  if (!dueDate) {
    return { text: "Không hạn", isOverdue: false, isToday: false };
  }
  const ref =
    typeof referenceDateInput === "string"
      ? referenceDateInput.split("T")[0]
      : referenceDateInput instanceof Date
      ? referenceDateInput.toISOString().split("T")[0]
      : getSystemReferenceDate();

  const due = dueDate.split("T")[0];
  if (due === ref) {
    return { text: "Hạn hôm nay", isOverdue: false, isToday: true };
  }
  if (due < ref) {
    const [, m, d] = due.split("-");
    return { text: `Quá hạn (${d}/${m})`, isOverdue: true, isToday: false };
  }
  const [, m, d] = due.split("-");
  return { text: `Hạn ${d}/${m}`, isOverdue: false, isToday: false };
}

export function WorkbenchMobileFeed(props: WorkbenchMobileFeedProps) {
  const contextData = useOptionalDashboardData();
  let modalContext: ReturnType<typeof useDashboardModal> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    modalContext = useDashboardModal();
  } catch {
    modalContext = null;
  }

  const user = props.user ?? contextData?.user ?? null;
  const isExecutive = props.isExecutive ?? contextData?.isExecutive ?? false;
  const isManager = props.isManager ?? contextData?.isManager ?? false;
  const isStaff =
    props.isStaff ??
    contextData?.isStaff ??
    (!isExecutive && !isManager);

  const stats = props.stats ?? contextData?.displayedStats ?? contextData?.stats;
  const executiveStats = props.executiveStats ?? contextData?.executiveStats;
  const tasks = props.tasks ?? contextData?.filteredTasks ?? contextData?.tasks ?? [];
  const referenceDate = props.referenceDate ?? getSystemReferenceDate();

  const handleSelectTask = (task: SchoolTask | StaffTask) => {
    if (props.onSelectTask) {
      props.onSelectTask(task);
    } else if (modalContext?.openTaskDetail) {
      modalContext.openTaskDetail(task);
    }
  };

  // 1. Phân loại chỉ số & danh sách công việc cần xử lý ngay
  const pendingApprovalCount = isExecutive
    ? (executiveStats?.pendingSchoolApprovalCount ?? stats?.needsReviewTasksCount ?? 0)
    : (stats?.needsReviewTasksCount ?? 0);

  const overdueCount = isExecutive
    ? (executiveStats?.overdueTasksCount ?? stats?.overdueTasksCount ?? 0)
    : (stats?.overdueTasksCount ?? 0);

  // Danh sách công việc cần chú ý ngay
  const urgentTasksList = React.useMemo(() => {
    if (props.urgentTasks && props.urgentTasks.length > 0) {
      return props.urgentTasks.slice(0, 3);
    }

    if (isExecutive || isManager) {
      // Ưu tiên task chờ duyệt (NEEDS_REVIEW) hoặc quá hạn
      return tasks
        .filter((t) => {
          const isReview = t.status === "NEEDS_REVIEW";
          const isPastDue = t.dueDate && t.dueDate.split("T")[0] < String(referenceDate).split("T")[0] && t.status !== "COMPLETED";
          return isReview || isPastDue;
        })
        .slice(0, 3);
    }

    // Staff: việc có deadline hôm nay, việc quá hạn hoặc đang làm
    return tasks
      .filter((t) => {
        if (t.status === "COMPLETED") return false;
        const due = t.dueDate ? t.dueDate.split("T")[0] : null;
        const ref = String(referenceDate).split("T")[0];
        const isUrgent = t.priority === "URGENT" || t.priority === "HIGH";
        const isDueSoon = due && due <= ref;
        return isDueSoon || isUrgent || t.status === "IN_PROGRESS";
      })
      .slice(0, 3);
  }, [props.urgentTasks, isExecutive, isManager, tasks, referenceDate]);

  // 2. Danh sách nhiệm vụ trọng tâm (Key Tasks: max 3-5 items)
  const keyTasksList = React.useMemo(() => {
    if (props.keyTasks && props.keyTasks.length > 0) {
      return props.keyTasks.slice(0, 5);
    }

    return tasks
      .filter((t) => t.status !== "COMPLETED")
      .sort((a, b) => {
        // Ưu tiên URGENT -> HIGH -> MEDIUM -> LOW
        const priorityOrder: Record<string, number> = {
          URGENT: 4,
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
        };
        const pA = priorityOrder[a.priority || "MEDIUM"] || 2;
        const pB = priorityOrder[b.priority || "MEDIUM"] || 2;
        if (pB !== pA) return pB - pA;

        // Nếu trùng độ ưu tiên, xếp theo hạn chót gần nhất
        const dueA = a.dueDate || "9999-12-31";
        const dueB = b.dueDate || "9999-12-31";
        return dueA.localeCompare(dueB);
      })
      .slice(0, 5);
  }, [props.keyTasks, tasks]);

  // 3. Lịch công tác hôm nay
  const scheduleItems = props.scheduleItems ?? [];

  // 4. Thông báo điều hành mới
  const noticeItems = React.useMemo(() => {
    if (props.notices && props.notices.length > 0) {
      return props.notices.slice(0, 3);
    }
    if (contextData?.activities && contextData.activities.length > 0) {
      return contextData.activities.slice(0, 3).map((act, index) => ({
        id: act.id || `activity-${index}`,
        title:
          act.targetTitle
            ? `${act.action}: ${act.targetTitle}`
            : act.action || "Hoạt động điều hành mới",
        timeAgo: act.timestamp || "Vừa xong",
        sender: act.actorName || "Hệ thống",
        href: "/tasks",
      }));
    }
    return [];
  }, [props.notices, contextData?.activities]);

  const greeting = getAcademicGreeting(user?.name);
  const formattedDate = formatVietnameseCurrentDate(referenceDate);
  const roleChip = getRoleChipLabel(isExecutive, isManager, user?.department);

  const tasksScopeHref = isExecutive
    ? "/tasks?scope=school"
    : isManager
    ? "/tasks?scope=unit"
    : "/tasks?scope=my";

  return (
    <div
      className={cn("w-full space-y-5 pb-6", props.className)}
      data-slot="mobile-workbench-feed"
    >
      {/* HEADER: Chào hỏi ân cần & Ngày tháng & Chip vai trò */}
      <header
        className="rounded-2xl border border-border/70 bg-card p-4 shadow-subtle space-y-2.5"
        data-section="mobile-workbench-header"
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs"
            data-slot="role-chip"
          >
            {roleChip}
          </span>
          <span className="font-mono tabular-nums text-xs text-muted-foreground">
            {formattedDate}
          </span>
        </div>

        <div>
          <h1 className="text-lg font-bold font-heading text-foreground tracking-tight">
            {greeting}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isExecutive
              ? "Tổng quan các điểm nghẽn và hồ sơ cần chỉ đạo trong ngày"
              : isManager
              ? "Theo dõi tiến độ đơn vị và các hồ sơ chờ thẩm định L1"
              : "Tập trung hoàn thành nhiệm vụ và nộp minh chứng đúng hạn"}
          </p>
        </div>
      </header>

      {/* PHẦN 1: CẦN XỬ LÝ NGAY (Needs Attention) */}
      <section
        className="space-y-3"
        aria-label="Cần xử lý ngay"
        data-section="needs-attention"
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <h2 className="font-heading font-bold text-sm text-foreground uppercase tracking-wider">
              Cần xử lý ngay
            </h2>
          </div>
          {(pendingApprovalCount > 0 || overdueCount > 0) && (
            <span className="font-mono tabular-nums text-xs font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
              {pendingApprovalCount + overdueCount} việc cấp bách
            </span>
          )}
        </div>

        {/* Thống kê nhanh cấp bách cho BGH / Lãnh đạo đơn vị */}
        {(isExecutive || isManager) ? (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 flex flex-col justify-between min-h-[64px]">
              <span className="text-xs font-medium text-amber-900">
                Chờ phê duyệt
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-mono tabular-nums text-xl font-extrabold text-amber-900">
                  {pendingApprovalCount}
                </span>
                <span className="text-xs text-amber-700/80 font-medium">
                  hồ sơ
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-rose-500/25 bg-rose-500/5 flex flex-col justify-between min-h-[64px]">
              <span className="text-xs font-medium text-rose-900">
                {isExecutive ? "Quá hạn toàn trường" : "Quá hạn đơn vị"}
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-mono tabular-nums text-xl font-extrabold text-rose-900">
                  {overdueCount}
                </span>
                <span className="text-xs text-rose-700/80 font-medium">
                  nhiệm vụ
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Thống kê nhanh cho Viên chức / Giảng viên */
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl border border-blue-500/25 bg-blue-500/5 flex flex-col justify-between min-h-[64px]">
              <span className="text-xs font-medium text-blue-900">
                Hạn chót hôm nay
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-mono tabular-nums text-xl font-extrabold text-blue-900">
                  {tasks.filter((t) => t.dueDate && t.dueDate.split("T")[0] === String(referenceDate).split("T")[0] && t.status !== "COMPLETED").length}
                </span>
                <span className="text-xs text-blue-700/80 font-medium">
                  cần xong
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-indigo-500/25 bg-indigo-500/5 flex flex-col justify-between min-h-[64px]">
              <span className="text-xs font-medium text-indigo-900">
                Chờ nộp minh chứng
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-mono tabular-nums text-xl font-extrabold text-indigo-900">
                  {tasks.filter((t) => t.status === "IN_PROGRESS").length}
                </span>
                <span className="text-xs text-indigo-700/80 font-medium">
                  hồ sơ
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Danh sách thẻ hành động trực tiếp */}
        <div className="space-y-2">
          {urgentTasksList.length > 0 ? (
            urgentTasksList.map((task) => {
              const dueInfo = formatShortDueDate(task.dueDate, referenceDate);
              const isNeedsReview = task.status === "NEEDS_REVIEW";

              return (
                <div
                  key={task.id}
                  onClick={() => handleSelectTask(task)}
                  className="w-full p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/40 active:bg-muted/60 transition-colors shadow-2xs space-y-2 cursor-pointer touch-manipulation min-h-[48px]"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectTask(task);
                    }
                  }}
                  aria-label={`Xử lý công việc: ${task.title}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">
                      {"code" in task && task.code ? task.code : "NV-QCET"}
                    </span>
                    {isNeedsReview ? (
                      <Badge variant="warning" className="text-xs px-2 py-0.5">
                        Chờ duyệt
                      </Badge>
                    ) : dueInfo.isOverdue ? (
                      <Badge variant="destructive" className="text-xs px-2 py-0.5 font-mono tabular-nums">
                        {dueInfo.text}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs px-2 py-0.5 font-mono tabular-nums">
                        {dueInfo.text}
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                    {task.title}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                    <span className="truncate max-w-[180px]">
                      {"department" in task ? task.department : "Đơn vị trực thuộc"}
                    </span>
                    <span className="text-primary font-medium inline-flex items-center gap-1 shrink-0">
                      <span>{isNeedsReview ? "Thẩm định" : "Xử lý"}</span>
                      <ChevronRight size={13} strokeWidth={1.5} />
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center space-y-1">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 mb-1">
                <CheckCircle2 size={18} strokeWidth={1.5} />
              </div>
              <p className="text-xs font-semibold text-emerald-800">
                Tiến độ thông suốt, không có việc tồn đọng khẩn cấp
              </p>
              <p className="text-xs text-emerald-700/80">
                Mọi hồ sơ và nhiệm vụ hiện đều đảm bảo đúng kế hoạch.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* PHẦN 2: NHIỆM VỤ TRỌNG TÂM (Key Tasks: Max 3-5 items) */}
      <section
        className="space-y-3"
        aria-label="Nhiệm vụ trọng tâm"
        data-section="key-tasks"
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <h2 className="font-heading font-bold text-sm text-foreground uppercase tracking-wider">
              Nhiệm vụ trọng tâm
            </h2>
          </div>
          <span className="font-mono tabular-nums text-xs text-muted-foreground">
            {keyTasksList.length}/{tasks.length} nhiệm vụ
          </span>
        </div>

        <div className="space-y-2">
          {keyTasksList.map((task) => {
            const dueInfo = formatShortDueDate(task.dueDate, referenceDate);
            const progress = task.progressPercent ?? 0;
            // P0-03 / T03: completion is LIFECYCLE state, never percent. A task at
            // progress 100 that is still WAITING_APPROVAL or NEEDS_REVIEW must not
            // render as done.
            const isCompleted = task.status === "COMPLETED";

            return (
              <div
                key={task.id}
                onClick={() => handleSelectTask(task)}
                className="w-full p-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 active:bg-muted/60 transition-colors shadow-2xs space-y-2 cursor-pointer touch-manipulation min-h-[48px]"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectTask(task);
                  }
                }}
                aria-label={`Mở nhiệm vụ: ${task.title}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">
                    {task.code || "NV-QCET"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {task.priority === "URGENT" && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0">
                        Khẩn
                      </Badge>
                    )}
                    {task.priority === "HIGH" && (
                      <Badge variant="warning" className="text-xs px-1.5 py-0">
                        Cao
                      </Badge>
                    )}
                    <span className="font-mono tabular-nums text-xs text-muted-foreground">
                      {dueInfo.text}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                  {task.title}
                </h3>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate max-w-[190px]">
                      {task.department || "Đơn vị chủ trì"}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-foreground">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        isCompleted
                          ? "bg-emerald-500"
                          : progress >= 50
                          ? "bg-primary"
                          : "bg-amber-500"
                      )}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Nút Xem tất cả nhiệm vụ */}
        <Link
          href={tasksScopeHref}
          className="w-full min-h-[48px] rounded-xl border border-border bg-background hover:bg-muted/50 active:bg-muted font-medium text-xs text-foreground flex items-center justify-center gap-1.5 shadow-2xs touch-manipulation transition-colors"
          data-slot="view-all-tasks-btn"
        >
          <span>Xem tất cả nhiệm vụ</span>
          <span className="font-mono tabular-nums font-semibold text-primary">
            ({tasks.length})
          </span>
          <ArrowRight size={14} strokeWidth={1.5} className="text-primary" />
        </Link>
      </section>

      {/* PHẦN 3: LỊCH CÔNG TÁC HÔM NAY (Today's Schedule) */}
      <section
        className="space-y-3"
        aria-label="Lịch công tác hôm nay"
        data-section="today-schedule"
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <h2 className="font-heading font-bold text-sm text-foreground uppercase tracking-wider">
              Lịch công tác hôm nay
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {scheduleItems.length} sự kiện
          </span>
        </div>

        <div className="space-y-2">
          {scheduleItems.length > 0 ? (
            scheduleItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1.5 min-h-[48px]"
              >
                <div className="flex items-center gap-2">
                  <Clock size={14} strokeWidth={1.5} className="text-indigo-600 shrink-0" />
                  <span className="font-mono tabular-nums text-xs font-bold text-indigo-700 bg-indigo-500/10 px-2 py-0.5 rounded">
                    {item.time}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground leading-snug">
                  {item.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                  <MapPin size={13} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.location}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/10 text-center space-y-1 min-h-[48px] flex flex-col items-center justify-center">
              <p className="text-xs text-muted-foreground font-medium">
                Không có lịch công tác nào trong ngày
              </p>
            </div>
          )}
        </div>

        <Link
          href="/calendar"
          className="w-full min-h-[48px] rounded-xl border border-border bg-background hover:bg-muted/50 active:bg-muted font-medium text-xs text-foreground flex items-center justify-center gap-1.5 shadow-2xs touch-manipulation transition-colors"
          data-slot="view-calendar-btn"
        >
          <CalendarIcon size={14} strokeWidth={1.5} className="text-indigo-600" />
          <span>Xem lịch công tác tuần</span>
          <ArrowRight size={14} strokeWidth={1.5} className="text-indigo-600" />
        </Link>
      </section>

      {/* PHẦN 4: THÔNG BÁO ĐIỀU HÀNH MỚI (Recent Notices) */}
      <section
        className="space-y-3"
        aria-label="Thông báo điều hành mới"
        data-section="recent-notices"
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <h2 className="font-heading font-bold text-sm text-foreground uppercase tracking-wider">
              Thông báo điều hành mới
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {noticeItems.length} mới
          </span>
        </div>

        <div className="space-y-2">
          {noticeItems.length > 0 ? (
            noticeItems.map((notice) => (
              <Link
                key={notice.id}
                href={notice.href || "/documents"}
                className="block p-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 active:bg-muted/60 transition-colors shadow-2xs space-y-1.5 touch-manipulation min-h-[48px]"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Bell size={14} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-foreground line-clamp-2 leading-relaxed">
                      {notice.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span className="truncate">{notice.sender || "Hệ thống"}</span>
                      <span className="font-mono tabular-nums shrink-0 ml-2">
                        {notice.timeAgo}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/10 text-center space-y-1 min-h-[48px] flex flex-col items-center justify-center">
              <p className="text-xs text-muted-foreground font-medium">
                Không có thông báo mới
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
