"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Plus,
  Calendar,
  User,
  ListTodo,
  Inbox,
  SearchX,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  FilterX,
  Layers,
  Building2,
  GraduationCap,
  Briefcase,
  Check,
  Bell,
  UserCheck,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetClose,
} from "@/components/ui/bottom-sheet";
import type {
  SchoolTask,
  StaffTask,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import { useAuth } from "@/lib/auth-context";
import { canAssignUnitTask, matchesUser } from "@/lib/role-task-filter";
import { resolveDepartmentId } from "@/lib/executive-matrix-aggregator";
import { useDisplayDensity } from "@/components/density-provider";
import { useOptionalDashboardData } from "@/components/dashboard/dashboard-context";
import {
  getAcademicMonthPeriod,
  isDateInAcademicMonth,
} from "@/lib/academic-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSwipeAction } from "@/hooks/use-swipe-action";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

export interface CategoryBadgeConfig {
  label: string;
  className: string;
}

export interface StatusBadgeConfig {
  label: string;
  className: string;
  variant:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "ghost"
    | "success"
    | "progress"
    | "warning"
    | "sapphire"
    | "emerald"
    | "amber"
    | "rose"
    | "violet";
}

export interface CategoryTab {
  id: TaskCategory | "ALL";
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export const CATEGORY_TABS: CategoryTab[] = [
  { id: "ALL", label: "Tất cả", icon: Layers },
  { id: "CHUYEN_DOI_SO", label: "Chuyển đổi số", icon: Building2 },
  { id: "TRUYEN_THONG", label: "Truyền thông", icon: Briefcase },
  { id: "CNTT", label: "CNTT", icon: Layers },
  { id: "ATTT", label: "An toàn thông tin", icon: Briefcase },
  { id: "THU_VIEN", label: "Thư viện", icon: GraduationCap },
  { id: "BAO_CAO", label: "Báo cáo", icon: Calendar },
];

export const DEPARTMENT_OPTIONS = [
  { id: "ALL", label: "Tất cả đơn vị (Toàn trường)" },
  { id: "BGH", label: "Ban Giám hiệu" },
  { id: "CNTT", label: "Khoa Công nghệ thông tin" },
  { id: "DAO_TAO", label: "Phòng Đào tạo & QLKH" },
  { id: "TRUYEN_THONG", label: "TT Truyền thông & Số hóa" },
  { id: "HANH_CHINH", label: "Phòng Hành chính - Quản trị" },
  { id: "KHAO_THI", label: "Phòng Khảo thí & ĐBCL" },
  { id: "THU_VIEN", label: "TT Ngoại ngữ - TH & Thư viện" },
  { id: "KINH_TE", label: "Khoa Kinh tế - Quản trị" },
  { id: "KY_THUAT", label: "Khoa Kỹ thuật - Công nghệ" },
  { id: "TAI_CHINH", label: "Phòng Kế hoạch - Tài chính" },
  { id: "CTHSSV", label: "Phòng Công tác HSSV" },
];

export function getCategoryBadgeConfig(
  category: TaskCategory | string
): CategoryBadgeConfig {
  switch (category) {
    case "CHUYEN_DOI_SO":
      return {
        label: "Chuyển đổi số",
        className:
          "bg-secondary text-muted-foreground border-transparent",
      };
    case "TRUYEN_THONG":
      return {
        label: "Truyền thông",
        className:
          "bg-secondary text-muted-foreground border-transparent",
      };
    case "CNTT":
      return {
        label: "CNTT",
        className:
          "bg-secondary text-muted-foreground border-transparent",
      };
    case "ATTT":
      return {
        label: "An toàn thông tin",
        className:
          "bg-secondary text-muted-foreground border-transparent",
      };
    case "THU_VIEN":
      return {
        label: "Thư viện",
        className:
          "bg-secondary text-muted-foreground border-transparent",
      };
    case "BAO_CAO":
      return {
        label: "Báo cáo",
        className:
          "bg-secondary text-muted-foreground border-transparent",
      };
    case "KHAC":
    case "OTHER":
    default:
      return {
        label: "Khác",
        className:
          "bg-secondary text-muted-foreground border-transparent",
      };
  }
}

export function getStatusBadgeConfig(
  status: TaskStatus | string
): StatusBadgeConfig {
  switch (status) {
    case "NEW":
      return {
        label: "Mới",
        className:
          "border-rose-500/20 bg-rose-500/10 text-rose-700",
        variant: "destructive",
      };
    case "IN_PROGRESS":
      return {
        label: "Đang thực hiện",
        className:
          "border-blue-500/20 bg-blue-500/10 text-blue-700",
        variant: "sapphire",
      };
    case "NEEDS_REVIEW":
      return {
        label: "Cần chỉnh sửa",
        className:
          "border-amber-500/20 bg-amber-500/10 text-amber-700",
        variant: "amber",
      };
    case "WAITING_APPROVAL":
      return {
        label: "Chờ phê duyệt",
        className:
          "border-amber-500/20 bg-amber-500/10 text-amber-700",
        variant: "amber",
      };
    case "COMPLETED":
      return {
        label: "Hoàn thành",
        className:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
        variant: "emerald",
      };
    case "OVERDUE":
      return {
        label: "Quá hạn",
        className:
          "border-rose-500/20 bg-rose-500/10 text-rose-700",
        variant: "rose",
      };
    default:
      return {
        label: typeof status === "string" ? status : "Chưa rõ",
        className:
          "border-zinc-200 bg-zinc-50 text-zinc-700",
        variant: "outline",
      };
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function filterTasksForTable(
  tasks: SchoolTask[],
  category: TaskCategory | "ALL",
  searchQuery: string,
  department: string = "ALL"
): SchoolTask[] {
  let result = tasks;

  if (department !== "ALL") {
    const canonicalDept = resolveDepartmentId(department) || department;
    result = result.filter((task) => {
      // Direct relational check on task department fields
      const taskDept =
        task.departmentId ||
        task.leadDepartmentId ||
        task.departmentCode ||
        task.leadDepartmentCode ||
        task.department ||
        task.leadDepartment;

      const matchTaskDept =
        taskDept &&
        (taskDept === canonicalDept ||
          resolveDepartmentId(taskDept) === canonicalDept);

      const matchCoDept =
        task.coDepartmentCodes?.some(
          (code) =>
            code === canonicalDept ||
            resolveDepartmentId(code) === canonicalDept
        ) ||
        task.coDepartments?.some(
          (dept) =>
            dept === canonicalDept ||
            resolveDepartmentId(dept) === canonicalDept
        );

      const matchSchoolTask =
        matchTaskDept ||
        matchCoDept ||
        resolveDepartmentId(task.leadAssigneeName) === canonicalDept ||
        resolveDepartmentId(undefined, task.leadAssigneeName) === canonicalDept ||
        task.coAssignees?.some(
          (name) =>
            resolveDepartmentId(name) === canonicalDept ||
            resolveDepartmentId(undefined, name) === canonicalDept
        );

      const matchSubTasks = task.subTasks?.some((sub) => {
        const subDept = sub.departmentId || sub.departmentCode || sub.department;
        const matchSubDept =
          subDept &&
          (subDept === canonicalDept ||
            resolveDepartmentId(subDept) === canonicalDept);

        return (
          matchSubDept ||
          resolveDepartmentId(sub.assigneeName) === canonicalDept ||
          resolveDepartmentId(undefined, sub.assigneeName) === canonicalDept
        );
      });

      return Boolean(matchSchoolTask || matchSubTasks);
    });
  }

  if (category !== "ALL") {
    result = result.filter((task) => task.category === category);
  }

  const query = searchQuery.trim().toLowerCase();
  if (query) {
    result = result.filter((task) => {
      const matchTitle = task.title.toLowerCase().includes(query);
      const matchId = task.id.toLowerCase().includes(query);
      const matchLead = task.leadAssigneeName.toLowerCase().includes(query);
      const matchCo = task.coAssignees?.some((name) =>
        name.toLowerCase().includes(query)
      );
      const matchSubtasks = task.subTasks?.some(
        (sub) =>
          sub.title.toLowerCase().includes(query) ||
          sub.id.toLowerCase().includes(query) ||
          sub.assigneeName.toLowerCase().includes(query)
      );

      return matchTitle || matchId || matchLead || matchCo || matchSubtasks;
    });
  }

  return result;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];
  pages.push(1);

  if (currentPage > 3) {
    pages.push("...");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  pages.push(totalPages);
  return pages;
}

const TODAY_ISO = "2026-09-04";

function isPastDueDate(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr;
  return d < TODAY_ISO;
}

export type WorkboxFilter = "ALL" | "MY_RECEIVED" | "MY_ASSIGNED" | "URGENT";

export interface CascadingTaskTableProps {
  tasks: SchoolTask[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onAddTask?: () => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onRefresh?: () => Promise<void> | void;
  className?: string;
  hideWorkbox?: boolean;
  hideToolbar?: boolean;
  onOpenSubmitModal?: (task: StaffTask) => void;
  selectedAcademicMonth?: number | "ALL";
  priorOverdueBacklog?: SchoolTask[];
}

interface MobileTaskCardProps {
  task: SchoolTask;
  isExpanded: boolean;
  onToggleExpand: (id: string, e: React.MouseEvent) => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  selectedAcademicMonth?: number | "ALL";
}

function MobileTaskCard({
  task,
  isExpanded,
  onToggleExpand,
  onSelectTask,
  onStatusChange,
  selectedAcademicMonth,
}: MobileTaskCardProps) {
  const statusConfig = getStatusBadgeConfig(task.status);

  const swipe = useSwipeAction({
    threshold: 72,
    onSwipeRight: () => {
      if (task.status === "IN_PROGRESS" && onStatusChange) {
        onStatusChange(task.id, "COMPLETED");
      }
    },
  });

  return (
    <article
      className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs space-y-2.5 touch-pan-y relative overflow-hidden transition-transform duration-150 ease-out"
      style={{
        transform: swipe.offset > 0 ? `translateX(${Math.min(swipe.offset, 48)}px)` : undefined,
      }}
      onTouchStart={swipe.onTouchStart}
      onTouchMove={swipe.onTouchMove}
      onTouchEnd={swipe.onTouchEnd}
    >
      {/* Swipe reveal background hint */}
      {swipe.offset > 12 && task.status === "IN_PROGRESS" && (
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500/15 flex items-center px-3 text-emerald-700 font-semibold text-xs transition-opacity"
          style={{ width: `${Math.min(swipe.offset, 64)}px` }}
        >
          <CheckCircle2 className="size-4 shrink-0" />
        </div>
      )}

      {/* Card Header: Task code & Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-bold text-primary">
          {task.taskCode || "NV-QCET"}
        </span>
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border",
            statusConfig.className
          )}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Card Title */}
      <h4
        onClick={() => onSelectTask?.(task)}
        className="text-sm font-semibold text-foreground line-clamp-2 leading-snug cursor-pointer active:text-primary"
      >
        {task.title}
      </h4>

      {/* Metadata Row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium pt-1 border-t border-border/40">
        <span>{task.leadAssigneeName || "QCET"}</span>
        <span>
          {task.dueDate ? formatDate(task.dueDate) : "Chưa có hạn"}
        </span>
      </div>

      {/* Quick Action Buttons - Always Visible on Mobile */}
      {onStatusChange && (
        <div className="flex items-center gap-2 pt-1">
          {task.status === "IN_PROGRESS" && (
            <button
              type="button"
              onClick={() => onStatusChange(task.id, "COMPLETED")}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white font-semibold text-xs active:scale-[0.98] touch-manipulation cursor-pointer"
            >
              Duyệt nhanh
            </button>
          )}
        </div>
      )}

      {/* Subtask Accordion Trigger */}
      {task.subTasks && task.subTasks.length > 0 && (
        <>
          <button
            type="button"
            onClick={(e) => onToggleExpand(task.id, e)}
            className="w-full min-h-[44px] flex items-center justify-between px-3 rounded-xl bg-muted/50 text-xs font-semibold text-foreground active:bg-muted"
          >
            <div className="flex items-center gap-2">
              <span>Nhiệm vụ con ({task.subTasks.length})</span>
              {selectedAcademicMonth && selectedAcademicMonth !== "ALL" && (() => {
                const dueInMonthCount = task.subTasks.filter(
                  (s) => s.dueDate && isDateInAcademicMonth(s.dueDate, selectedAcademicMonth, "2026-2027")
                ).length;
                if (dueInMonthCount > 0) {
                  return (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                      Hạn trong kỳ T{selectedAcademicMonth} ({dueInMonthCount})
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          </button>

          {isExpanded && (
            <div className="space-y-2 pt-1 border-t border-border/40 pl-2">
              {task.subTasks.map((subTask: StaffTask) => {
                const subStatusConfig = getStatusBadgeConfig(subTask.status);
                const isSubDueInMonth =
                  selectedAcademicMonth && selectedAcademicMonth !== "ALL" && subTask.dueDate
                    ? isDateInAcademicMonth(subTask.dueDate, selectedAcademicMonth, "2026-2027")
                    : false;

                return (
                  <div
                    key={subTask.id}
                    onClick={() => onSelectTask?.(subTask)}
                    className={cn(
                      "flex flex-col gap-1.5 p-2.5 rounded-xl bg-muted/30 border border-border/40 text-xs cursor-pointer active:bg-secondary transition-colors",
                      isSubDueInMonth && "bg-primary/[0.04] border-primary/25 shadow-2xs"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground font-semibold">
                          {subTask.id.toUpperCase()}
                        </span>
                        {isSubDueInMonth && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                            Hạn trong kỳ T{selectedAcademicMonth}
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border",
                          subStatusConfig.className
                        )}
                      >
                        {subStatusConfig.label}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground line-clamp-2">
                      {subTask.title}
                    </p>
                    <div className="flex items-center justify-between text-muted-foreground text-xs pt-1">
                      <span>{subTask.assigneeName}</span>
                      <span className={cn(isSubDueInMonth && "font-semibold text-primary font-mono")}>
                        {formatDate(subTask.dueDate)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </article>
  );
}

export function CascadingTaskTable({
  tasks,
  onSelectTask,
  onAddTask,
  onStatusChange,
  onRefresh,
  className,
  hideWorkbox = false,
  hideToolbar = false,
  onOpenSubmitModal,
  selectedAcademicMonth: propSelectedAcademicMonth,
  priorOverdueBacklog: propPriorOverdueBacklog,
}: CascadingTaskTableProps) {
  const { user } = useAuth();
  const { density } = useDisplayDensity();
  const dashboardData = useOptionalDashboardData();
  const selectedAcademicMonth =
    propSelectedAcademicMonth ?? dashboardData?.selectedAcademicMonth ?? "ALL";
  const priorOverdueBacklog =
    propPriorOverdueBacklog ?? dashboardData?.priorOverdueBacklog ?? [];
  const [isBacklogExpanded, setIsBacklogExpanded] = React.useState(true);
  const canAssign = canAssignUnitTask(user?.role ?? "ADMIN");
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const [expandedTaskIds, setExpandedTaskIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const expandedIds = expandedTaskIds;
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = React.useState(false);

  // Keyboard shortcut ('/' outside form inputs) to focus table search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleExpand = (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const [activeWorkbox, setActiveWorkbox] = React.useState<WorkboxFilter>("ALL");
  const pullToRefresh = usePullToRefresh({ onRefresh });

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (selectedDepartment !== "ALL") count++;
    if (activeWorkbox !== "ALL") count++;
    return count;
  }, [selectedDepartment, activeWorkbox]);

  // Filter tasks by active E-Office Workbox (Việc tôi nhận, Việc tôi giao, v.v.)
  const workboxTasks = React.useMemo(() => {
    if (hideWorkbox || activeWorkbox === "ALL") return tasks;
    const userName = user?.name?.toLowerCase() || "";

    // ADMIN (BGH) sees all tasks in "Việc tôi giao/nhận" context
    if (user?.role === "ADMIN") {
      if (activeWorkbox === "MY_RECEIVED" || activeWorkbox === "MY_ASSIGNED") {
        return tasks;
      }
      if (activeWorkbox === "URGENT") {
        return tasks.filter((t) => {
          const isPastDue = isPastDueDate(t.dueDate) && t.status !== "COMPLETED";
          const hasSubUrgent = t.subTasks?.some((s) => {
            return (isPastDueDate(s.dueDate) && s.status !== "COMPLETED") || s.status === "NEEDS_REVIEW";
          });
          return isPastDue || hasSubUrgent;
        });
      }
      return tasks;
    }

    if (activeWorkbox === "MY_RECEIVED") {
      return tasks.filter((t) => {
        const isLead = matchesUser(t.leadAssigneeName, user) || (userName && t.leadAssigneeName.toLowerCase().includes(userName));
        const isCo = t.coAssignees?.some((c) =>
          matchesUser(c, user) || (userName && c.toLowerCase().includes(userName))
        );
        const hasSub = t.subTasks?.some((s) =>
          matchesUser(s.assigneeName, user) || (userName && s.assigneeName.toLowerCase().includes(userName))
        );
        return isLead || isCo || hasSub;
      });
    }

    if (activeWorkbox === "MY_ASSIGNED") {
      return tasks.filter((t) =>
        matchesUser(t.leadAssigneeName, user) || (userName && t.leadAssigneeName.toLowerCase().includes(userName))
      );
    }

    if (activeWorkbox === "URGENT") {
      return tasks.filter((t) => {
        const isPastDue = isPastDueDate(t.dueDate) && t.status !== "COMPLETED";
        const hasSubUrgent = t.subTasks?.some((s) => {
          return (isPastDueDate(s.dueDate) && s.status !== "COMPLETED") || s.status === "NEEDS_REVIEW";
        });
        return isPastDue || hasSubUrgent;
      });
    }

    return tasks;
  }, [tasks, activeWorkbox, user, hideWorkbox]);

  // Compute workbox counts for badge numbers
  const workboxCounts = React.useMemo(() => {
    const userName = user?.name?.toLowerCase() || "";
    const isAdmin = user?.role === "ADMIN";

    let received = 0;
    let assigned = 0;
    let urgent = 0;

    for (const t of tasks) {
      const isLead = matchesUser(t.leadAssigneeName, user) || (userName && t.leadAssigneeName.toLowerCase().includes(userName));
      const isCo = t.coAssignees?.some((c) =>
        matchesUser(c, user) || (userName && c.toLowerCase().includes(userName))
      );
      const hasSub = t.subTasks?.some((s) =>
        matchesUser(s.assigneeName, user) || (userName && s.assigneeName.toLowerCase().includes(userName))
      );
      if (isAdmin || isLead || isCo || hasSub) received++;
      if (isAdmin || isLead) assigned++;

      const isPastDue = isPastDueDate(t.dueDate) && t.status !== "COMPLETED";
      const hasSubUrgent = t.subTasks?.some((s) => {
        return (isPastDueDate(s.dueDate) && s.status !== "COMPLETED") || s.status === "NEEDS_REVIEW";
      });
      if (isPastDue || hasSubUrgent) urgent++;
    }

    return {
      all: tasks.length,
      received,
      assigned,
      urgent,
    };
  }, [tasks, user]);

  const filteredTasks = React.useMemo(
    () =>
      hideToolbar
        ? workboxTasks
        : filterTasksForTable(
            workboxTasks,
            "ALL",
            deferredSearchQuery,
            selectedDepartment
          ),
    [hideToolbar, workboxTasks, deferredSearchQuery, selectedDepartment]
  );

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  // Reset to page 1 whenever workbox, search or department filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeWorkbox, deferredSearchQuery, selectedDepartment]);

  const totalTasks = filteredTasks.length;
  const totalPages = Math.max(1, Math.ceil(totalTasks / pageSize));

  const paginatedTasks = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  const monthPeriod = React.useMemo(() => {
    if (selectedAcademicMonth === "ALL") return null;
    return getAcademicMonthPeriod(selectedAcademicMonth, "2026-2027");
  }, [selectedAcademicMonth]);

  const monthlyIndicatorText = React.useMemo(() => {
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
      className={cn("flex flex-col gap-3.5", className)}
      data-slot="cascading-task-table"
    >
      {/* 4 E-Office Workboxes (Hộp việc chuẩn cơ quan với thiết kế Executive Precision) */}
      {!hideWorkbox && (
        <div className="relative">
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-2xl bg-muted/40 border border-border/50 backdrop-blur-xs scrollbar-none pr-6">
          <button
            type="button"
            onClick={() => setActiveWorkbox("ALL")}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] touch-manipulation",
              activeWorkbox === "ALL"
                ? "bg-card text-foreground font-bold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              <span className="hidden sm:inline">Tất cả nhiệm vụ</span>
              <span className="sm:hidden">Tất cả</span>
            </span>
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-mono tabular-nums text-primary font-semibold border border-primary/20">
              {workboxCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkbox("MY_RECEIVED")}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] touch-manipulation",
              activeWorkbox === "MY_RECEIVED"
                ? "bg-card text-foreground font-bold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="hidden sm:inline">Việc tôi nhận</span>
              <span className="sm:hidden">Tôi nhận</span>
            </span>
            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-xs font-mono tabular-nums text-emerald-700 font-semibold border border-emerald-500/20">
              {workboxCounts.received}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkbox("MY_ASSIGNED")}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] touch-manipulation",
              activeWorkbox === "MY_ASSIGNED"
                ? "bg-card text-foreground font-bold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500" />
              <span className="hidden sm:inline">Việc tôi giao</span>
              <span className="sm:hidden">Tôi giao</span>
            </span>
            <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-xs font-mono tabular-nums text-blue-700 font-semibold border border-blue-500/20">
              {workboxCounts.assigned}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkbox("URGENT")}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] touch-manipulation",
              activeWorkbox === "URGENT"
                ? "bg-card text-rose-700 font-bold shadow-xs border border-rose-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500" />
              <span className="hidden sm:inline">Khẩn &amp; Chậm tiến độ</span>
              <span className="sm:hidden">Khẩn cấp</span>
            </span>
            {workboxCounts.urgent > 0 && (
              <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-xs font-mono tabular-nums text-rose-700 font-semibold border border-rose-500/30">
                {workboxCounts.urgent}
              </span>
            )}
          </button>
        </div>
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/90 via-background/40 to-transparent rounded-r-2xl sm:hidden"
          aria-hidden="true"
        />
      </div>
    )}

      {/* Control Bar: Category Tabs & Search */}
      {!hideToolbar && (
        <>
          {/* Mobile Quick Search & Filter Bar (sm:hidden) */}
          <div className="flex sm:hidden items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70"
                strokeWidth={1.5}
              />
              <input
                type="text"
                placeholder="Tìm kiếm nhiệm vụ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground/60 transition-all hover:border-border focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 touch-manipulation"
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Mobile Filter Sheet Button */}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              aria-label="Mở bộ lọc nâng cao"
              className={cn(
                "h-10 px-3 min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors touch-manipulation shadow-2xs shrink-0",
                activeFilterCount > 0
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/70 bg-card text-foreground hover:bg-muted"
              )}
            >
              <SlidersHorizontal className="size-3.5" strokeWidth={1.75} />
              <span>Lọc</span>
              {activeFilterCount > 0 && (
                <span className="size-4 rounded-full bg-primary text-primary-foreground font-mono text-xs flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {onAddTask && (
              <button
                type="button"
                onClick={onAddTask}
                aria-label="Thêm nhiệm vụ mới"
                className="size-10 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer shadow-xs shrink-0 touch-manipulation active:scale-95"
              >
                <Plus className="size-4" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Desktop Control Bar: Department Filter, Search & Add Task (hidden sm:flex) */}
          <div className="hidden sm:flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Department Filter & Search Input */}
            <div className="flex flex-1 items-center gap-2 max-w-2xl">
              {/* Department Selector */}
              <div className="relative shrink-0">
                <select
                  aria-label="Lọc theo đơn vị thực hiện"
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="h-9.5 rounded-xl border border-border/70 bg-card px-3 pr-8 text-xs font-medium text-foreground transition-all hover:border-border focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-2xs appearance-none"
                >
                  {DEPARTMENT_OPTIONS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <ChevronDown className="size-3.5" strokeWidth={1.5} />
                </div>
              </div>

              {/* Search Box with / Shortcut */}
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70"
                  strokeWidth={1.5}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Tìm theo tên nhiệm vụ, mã NV, người chủ trì..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9.5 w-full rounded-xl border border-border/70 bg-card pl-9 pr-10 text-xs text-foreground placeholder:text-muted-foreground/60 transition-all hover:border-border focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 shadow-2xs"
                />
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5">
                  <kbd className="rounded border border-border/70 bg-muted/60 px-1.5 py-0.5 text-xs font-mono text-muted-foreground" title="Phím tắt lọc bảng: /">
                    /
                  </kbd>
                </div>
              </div>
            </div>

            {/* Right Action: Quick Add Task */}
            {onAddTask && (
              <Button
                type="button"
                onClick={onAddTask}
                size="sm"
                className="h-9.5 gap-1.5 rounded-xl px-3.5 text-xs font-semibold cursor-pointer shrink-0 shadow-xs"
              >
                <Plus className="size-4" strokeWidth={1.5} />
                <span>Thêm nhiệm vụ</span>
              </Button>
            )}
          </div>
        </>
      )}

      {/* Prior Overdue Backlog Collapsible Section */}
      {selectedAcademicMonth !== "ALL" && priorOverdueBacklog.length > 0 && (
        <section
          aria-label="Tồn đọng kỳ trước"
          data-slot="prior-overdue-backlog"
          className="rounded-2xl border border-amber-300/90 bg-amber-50/50 p-4 shadow-xs space-y-3 transition-all"
        >
          {/* Section Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex size-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-900 border border-amber-500/30">
                <RotateCcw className="size-4" strokeWidth={2} />
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
              aria-label={isBacklogExpanded ? "Thu gọn tồn đọng kỳ trước" : "Mở rộng tồn đọng kỳ trước"}
            >
              <span>{isBacklogExpanded ? "Thu gọn" : "Xem chi tiết"}</span>
              <ChevronDown
                className={cn("size-3.5 transition-transform duration-200", isBacklogExpanded && "rotate-180")}
              />
            </button>
          </div>

          {/* Collapsible Backlog Content */}
          {isBacklogExpanded && (
            <div className="space-y-2 pt-1 border-t border-amber-200/70">
              {/* Desktop Backlog Table */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-amber-200/80 bg-white/90 shadow-2xs">
                <table className="w-full text-left table-row-dense">
                  <thead>
                    <tr className="h-9 border-b border-amber-200/60 bg-amber-100/40 text-xs font-semibold text-amber-900 uppercase">
                      <th className="w-24 px-3 py-1.5">Mã NV</th>
                      <th className="px-3 py-1.5">Nhiệm vụ tồn đọng</th>
                      <th className="px-3 py-1.5">Chủ trì</th>
                      <th className="px-3 py-1.5">Hạn ban đầu</th>
                      <th className="px-3 py-1.5">Tiến độ</th>
                      <th className="w-52 px-3 py-1.5 text-right">Trạng thái &amp; Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/80">
                    {priorOverdueBacklog.map((task) => (
                      <tr
                        key={task.id}
                        tabIndex={0}
                        onClick={() => onSelectTask?.(task)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectTask?.(task);
                          }
                        }}
                        className="group cursor-pointer hover:bg-amber-100/30 transition-colors h-11 text-xs"
                        data-backlog-task-id={task.id}
                      >
                        <td className="px-3 py-2 font-mono font-bold text-amber-900">
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
                          <span className="font-mono font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-xs">
                            {task.dueDate ? formatDate(task.dueDate) : "Quá hạn"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="relative h-1.5 w-12 overflow-hidden rounded-full bg-secondary/80">
                              <div
                                className="h-full bg-amber-500"
                                style={{ width: `${task.progressPercent || 0}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs font-semibold text-muted-foreground">
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
                                    task.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED"
                                  );
                                }}
                                className="inline-flex h-6 items-center px-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                              >
                                Duyệt
                              </button>
                            )}
                            <Badge
                              variant="rose"
                              className="h-5.5 px-2 text-xs font-semibold tabular-nums shrink-0"
                            >
                              Quá hạn kỳ trước
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Backlog Cards */}
              <div className="md:hidden space-y-2">
                {priorOverdueBacklog.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask?.(task)}
                    className="rounded-xl border border-amber-200/90 bg-white/90 p-3 shadow-2xs space-y-2 cursor-pointer active:bg-amber-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-amber-900">
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
                      <span className="font-mono font-semibold text-rose-700">
                        {task.dueDate ? formatDate(task.dueDate) : "Quá hạn"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Main Table Container */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
        {/* Table Header Operational Strip */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border/50 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" strokeWidth={1.5} />
            <span className="font-semibold text-foreground font-mono" data-slot="monthly-indicator">
              {monthlyIndicatorText}
            </span>
          </div>
          {selectedAcademicMonth !== "ALL" && (
            <span className="text-xs text-muted-foreground font-mono">
              Chu kỳ ngày 25 đến ngày 24
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left table-row-dense">
            <caption className="sr-only">{monthlyIndicatorText}</caption>
            {/* Table Header */}
            <thead>
              <tr className="h-11 border-b border-border/50 bg-muted/40">
                <th className="w-9 h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground text-center">
                  <span className="sr-only">Mở rộng</span>
                </th>
                <th className="w-24 h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">Mã NV</th>
                <th className="h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">Nhiệm vụ cấp Trường</th>
                <th className="h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">Chủ trì nhiệm vụ</th>
                <th className="h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">Thời hạn hoàn thành</th>
                <th className="w-56 h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Tiến độ &amp; Thao tác</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border/50">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    {activeWorkbox === "MY_RECEIVED" || activeWorkbox === "MY_ASSIGNED" ? (
                      <div className="max-w-md mx-auto space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="inline-flex p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-glow-primary ring-1 ring-primary/20">
                          <Inbox className="size-8" strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm sm:text-base font-bold text-foreground">
                            {activeWorkbox === "MY_RECEIVED"
                              ? "Hòm việc cá nhân chưa có nhiệm vụ"
                              : "Bạn chưa tạo hoặc giao nhiệm vụ nào"}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed text-balance">
                            {activeWorkbox === "MY_RECEIVED"
                              ? `Tài khoản cán bộ ${user?.name ? user.name : ""} đã sẵn sàng. Hiện chưa có công việc nào được phân công riêng cho bạn trong hòm này. Bạn có thể xem toàn bộ nhiệm vụ của Trường hoặc chủ động nhận việc.`
                              : "Khi bạn chủ trì hoặc tạo các nhiệm vụ cấp Trường/Đơn vị, danh mục công việc do bạn giao sẽ xuất hiện tại đây để theo dõi tiến độ."}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveWorkbox("ALL");
                              setSelectedDepartment("ALL");
                              setSearchQuery("");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all cursor-pointer active:scale-95"
                          >
                            <Layers className="size-3.5" strokeWidth={1.5} />
                            <span>Xem tất cả nhiệm vụ toàn trường</span>
                            <ArrowRight className="size-3.5" strokeWidth={1.5} />
                          </button>
                          {onAddTask && (
                            <button
                              type="button"
                              onClick={onAddTask}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
                            >
                              <Plus className="size-3.5 text-primary" strokeWidth={1.5} />
                              <span>Tạo công việc mới</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-sm mx-auto space-y-2.5 animate-in fade-in duration-150">
                        <div className="inline-flex p-3 rounded-2xl bg-muted/60 text-muted-foreground border border-border/60">
                          <Inbox className="size-8" strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">
                            Không tìm thấy nhiệm vụ phù hợp
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {searchQuery
                              ? `Không có kết quả nào khớp với từ khóa "${searchQuery}".`
                              : "Thử thay đổi bộ lọc đơn vị hoặc từ khóa tìm kiếm."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDepartment("ALL");
                            setSearchQuery("");
                            setActiveWorkbox("ALL");
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer shadow-2xs"
                        >
                          <FilterX className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                          <span>Đặt lại bộ lọc &amp; Xem tất cả</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task) => {
                  const isExpanded = expandedTaskIds.has(task.id);
                  const hasSubtasks =
                    task.subTasks && task.subTasks.length > 0;

                  return (
                    <React.Fragment key={task.id}>
                      {/* Tier 1 Parent Row */}
                      <tr
                        tabIndex={0}
                        onClick={() => onSelectTask?.(task)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectTask?.(task);
                          }
                        }}
                        className={cn(
                          "group cursor-pointer transition-colors border-b border-border/50 hover:bg-secondary/40 focus-visible:outline-hidden focus-visible:bg-secondary/50",
                          density === "compact" ? "h-[38px] py-1.5" : "h-[48px] py-3",
                          isExpanded && "bg-muted/20"
                        )}
                        data-task-id={task.id}
                        data-task-tier="1"
                      >
                        {/* Expand / Collapse Caret */}
                        <td className={cn("table-cell-dense px-4 text-center align-middle", density === "compact" ? "py-1.5" : "py-3")}>
                          {hasSubtasks ? (
                            <button
                              type="button"
                              onClick={(e) => toggleExpand(task.id, e)}
                              className="inline-flex size-6 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-secondary hover:text-foreground cursor-pointer"
                              aria-label={
                                isExpanded ? "Thu gọn nhiệm vụ thành phần" : "Mở rộng nhiệm vụ thành phần"
                              }
                            >
                              {isExpanded ? (
                                <ChevronDown className="size-3.5" strokeWidth={1.5} />
                              ) : (
                                <ChevronRight className="size-3.5" strokeWidth={1.5} />
                              )}
                            </button>
                          ) : (
                            <span className="inline-block size-1.5 rounded-full bg-border" />
                          )}
                        </td>

                        {/* Task Code */}
                        <td className={cn("w-24 table-cell-dense px-4 align-middle whitespace-nowrap font-mono text-xs sm:text-[13px] tabular-nums text-muted-foreground font-semibold", density === "compact" ? "py-1.5" : "py-3")}>
                          {task.id.toUpperCase()}
                        </td>

                        {/* Task Title */}
                        <td className={cn("table-cell-dense px-4 align-middle text-sm font-medium text-foreground leading-snug", density === "compact" ? "py-1.5" : "py-3")}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="line-clamp-1 text-sm font-medium text-foreground leading-snug">{task.title}</span>
                            {hasSubtasks && (
                              <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                                {task.completedSubTasks}/{task.totalSubTasks}
                              </span>
                            )}
                            {selectedAcademicMonth !== "ALL" && hasSubtasks && (() => {
                              const dueInMonthCount = task.subTasks?.filter(
                                (s) => s.dueDate && isDateInAcademicMonth(s.dueDate, selectedAcademicMonth, "2026-2027")
                              ).length || 0;
                              if (dueInMonthCount > 0) {
                                return (
                                  <span
                                    className="rounded-md bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums"
                                    title={`${dueInMonthCount} nhiệm vụ con đến hạn trong Kỳ Tháng ${selectedAcademicMonth}`}
                                  >
                                    Hạn trong kỳ T{selectedAcademicMonth} ({dueInMonthCount} NV con)
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </td>

                        {/* Lead Assignee */}
                        <td className={cn("table-cell-dense px-4 align-middle whitespace-nowrap", density === "compact" ? "py-1.5" : "py-3")}>
                          <div className="flex items-center gap-2">
                            {task.leadAssigneeAvatar ? (
                              <img
                                src={task.leadAssigneeAvatar}
                                alt=""
                                aria-hidden="true"
                                width={24}
                                height={24}
                                loading="lazy"
                                className="size-6 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold tabular-nums text-secondary-foreground">
                                {getInitials(task.leadAssigneeName)}
                              </span>
                            )}
                            <span className="text-xs font-medium text-foreground/90">
                              {task.leadAssigneeName}
                            </span>
                          </div>
                        </td>

                        {/* Due Date */}
                        <td className={cn("table-cell-dense px-4 align-middle whitespace-nowrap text-muted-foreground font-mono tabular-nums text-xs font-semibold", density === "compact" ? "py-1.5" : "py-3")}>
                          {formatDate(task.dueDate)}
                        </td>

                        {/* Progress Bar & Metric with Quick Actions */}
                        <td className={cn("table-cell-dense px-4 align-middle text-right whitespace-nowrap", density === "compact" ? "py-1.5" : "py-3")}>
                          <div className="flex items-center justify-end gap-2">
                            {/* Micro-ghost Quick Actions */}
                            <div className="flex items-center gap-1">
                              {onStatusChange && task.status === "IN_PROGRESS" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onStatusChange(task.id, "COMPLETED");
                                  }}
                                  className="inline-flex h-6 items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 text-xs font-semibold tabular-nums text-emerald-700 hover:bg-emerald-500/20 cursor-pointer active:scale-[0.98] transition-colors"
                                  title="Duyệt nhanh hoàn thành nhiệm vụ"
                                >
                                  <Check className="size-3" strokeWidth={1.5} />
                                  <span>Duyệt nhanh</span>
                                </button>
                              )}

                              {task.status !== "COMPLETED" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 text-xs font-semibold tabular-nums text-amber-700 hover:bg-amber-500/20 cursor-pointer active:scale-[0.98] transition-colors"
                                  title="Đôn đốc tiến độ thực hiện"
                                >
                                  <Bell className="size-3" strokeWidth={1.5} />
                                  <span>Đôn đốc</span>
                                </button>
                              )}

                              {canAssign && onAddTask && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddTask();
                                  }}
                                  className="inline-flex h-6 items-center gap-1 rounded-md border border-border/60 bg-secondary/60 px-2 text-xs font-semibold tabular-nums text-foreground hover:bg-secondary hover:text-foreground cursor-pointer active:scale-[0.98] transition-colors"
                                  title="Phân công thêm nhiệm vụ thành phần"
                                >
                                  <UserCheck className="size-3" strokeWidth={1.5} />
                                  <span>Phân công</span>
                                </button>
                              )}
                            </div>

                            <div className="relative flex h-2 w-16 overflow-hidden rounded-full bg-secondary/80">
                              <div
                                className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, task.progressPercent)
                                  )}%`,
                                }}
                              />
                              {task.progressPercent > 0 && task.progressPercent < 100 && (
                                <div
                                  className="h-full bg-blue-500/30 transition-all duration-500 ease-out"
                                  style={{
                                    width: `${
                                      100 -
                                      Math.min(
                                        100,
                                        Math.max(0, task.progressPercent)
                                      )
                                    }%`,
                                  }}
                                />
                              )}
                            </div>
                            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                              {task.progressPercent}%
                            </span>

                            <Badge
                              variant={task.status === "COMPLETED" ? "emerald" : "sapphire"}
                              onClick={(e) => {
                                if (onStatusChange) {
                                  e.stopPropagation();
                                  onStatusChange(
                                    task.id,
                                    task.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED"
                                  );
                                }
                              }}
                              title={onStatusChange ? "Click để chuyển đổi trạng thái" : undefined}
                              className={cn(
                                "h-5.5 px-2.5 text-xs font-semibold tabular-nums leading-none shrink-0",
                                task.status === "COMPLETED"
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                  : "bg-blue-500/10 text-blue-700 border-blue-500/20",
                                onStatusChange && "cursor-pointer hover:bg-muted/40 transition-colors"
                              )}
                            >
                              {task.status === "COMPLETED" ? "Hoàn thành" : "Đang thực hiện"}
                            </Badge>
                          </div>
                        </td>
                      </tr>

                      {/* Tier 2 Nested Container (Sub-tasks) */}
                      {isExpanded && hasSubtasks && (
                        <tr>
                          <td
                            colSpan={6}
                            className="bg-muted/15 p-0"
                            data-parent-id={task.id}
                            data-task-tier="2"
                          >
                            <div className="py-2.5 pr-4 pl-[34px]">
                              <div className="border-l-2 border-primary/30 pl-4 space-y-1.5">
                                {task.subTasks.map((subTask) => {
                                  const statusConfig = getStatusBadgeConfig(
                                    subTask.status
                                  );
                                  const isSubDueInMonth =
                                    selectedAcademicMonth !== "ALL" && subTask.dueDate
                                      ? isDateInAcademicMonth(subTask.dueDate, selectedAcademicMonth, "2026-2027")
                                      : false;

                                  return (
                                    <div
                                      key={subTask.id}
                                      tabIndex={0}
                                      onClick={() => onSelectTask?.(subTask)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          onSelectTask?.(subTask);
                                        }
                                      }}
                                      className={cn(
                                        "group/sub flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs transition-colors hover:bg-secondary/60 focus-visible:outline-hidden focus-visible:bg-secondary/70 cursor-pointer",
                                        isSubDueInMonth && "bg-primary/[0.04] border border-primary/20 shadow-2xs"
                                      )}
                                      data-subtask-id={subTask.id}
                                    >
                                      {/* Subtask Status Badge & ID & Title */}
                                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <Badge
                                          variant={statusConfig.variant}
                                          onClick={(e) => {
                                            if (onStatusChange) {
                                              e.stopPropagation();
                                              const nextStatus: TaskStatus =
                                                subTask.status === "COMPLETED"
                                                  ? "IN_PROGRESS"
                                                  : subTask.status === "IN_PROGRESS"
                                                  ? "COMPLETED"
                                                  : "IN_PROGRESS";
                                              onStatusChange(subTask.id, nextStatus);
                                            }
                                          }}
                                          title={
                                            onStatusChange
                                              ? "Click để chuyển đổi trạng thái"
                                              : undefined
                                          }
                                          className={cn(
                                            "h-5.5 px-2 text-xs font-semibold tabular-nums leading-none shrink-0",
                                            onStatusChange &&
                                              "cursor-pointer hover:bg-muted/40 transition-colors",
                                            statusConfig.className
                                          )}
                                        >
                                          {statusConfig.label}
                                        </Badge>
                                        <span className="font-mono text-xs text-muted-foreground/70 tabular-nums font-semibold shrink-0">
                                          {subTask.id.toUpperCase()}
                                        </span>
                                        <span className="truncate text-foreground/90 font-medium text-sm">
                                          {subTask.title}
                                        </span>
                                        {isSubDueInMonth && (
                                          <span
                                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0"
                                            title={`Nhiệm vụ con đến hạn trong Kỳ Tháng ${selectedAcademicMonth}`}
                                          >
                                            Hạn trong kỳ T{selectedAcademicMonth}
                                          </span>
                                        )}

                                        {/* 1-Click Fast Workflow Action for Subtask */}
                                        {onStatusChange && (
                                          <div className="shrink-0">
                                            {subTask.status === "NEW" && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onStatusChange(subTask.id, "IN_PROGRESS");
                                                }}
                                                className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 text-xs font-semibold tabular-nums border border-blue-500/20 cursor-pointer active:scale-[0.98] transition-colors"
                                                title="Tiếp nhận nhiệm vụ này"
                                              >
                                                <ArrowRight className="size-3" strokeWidth={1.5} />
                                                <span>Tiếp nhận</span>
                                              </button>
                                            )}
                                            {subTask.status === "IN_PROGRESS" && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onStatusChange(subTask.id, "COMPLETED");
                                                }}
                                                className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 text-xs font-semibold tabular-nums border border-emerald-500/20 cursor-pointer active:scale-[0.98] transition-colors"
                                                title="Báo cáo hoàn thành"
                                              >
                                                <Check className="size-3" strokeWidth={1.5} />
                                                <span>Hoàn thành</span>
                                              </button>
                                            )}
                                            {subTask.status === "NEEDS_REVIEW" && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onStatusChange(subTask.id, "IN_PROGRESS");
                                                }}
                                                className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 text-xs font-semibold tabular-nums border border-amber-500/20 cursor-pointer active:scale-[0.98] transition-colors"
                                                title="Tiếp nhận chỉnh sửa"
                                              >
                                                <RotateCcw className="size-3" strokeWidth={1.5} />
                                                <span>Chỉnh sửa</span>
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Subtask Assignee & Due Date */}
                                      <div className="flex items-center gap-4 shrink-0">
                                        <div className="flex items-center gap-1.5">
                                          {subTask.assigneeAvatar ? (
                                            <img
                                              src={subTask.assigneeAvatar}
                                              alt=""
                                              aria-hidden="true"
                                              width={20}
                                              height={20}
                                              loading="lazy"
                                              className="size-5 rounded-full object-cover shrink-0"
                                            />
                                          ) : (
                                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold tabular-nums text-secondary-foreground">
                                              {getInitials(subTask.assigneeName)}
                                            </span>
                                          )}
                                          <span className="text-xs font-medium text-muted-foreground">
                                            {subTask.assigneeName}
                                          </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground/80 tabular-nums font-mono font-semibold">
                                          {formatDate(subTask.dueDate)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {totalTasks > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-muted/20 border-t border-border/50 text-xs text-muted-foreground">
            {/* Left: Range and Page Size selector */}
            <div className="flex items-center gap-3">
              <span>
                Hiển thị{" "}
                <strong className="text-foreground font-semibold tabular-nums">
                  {Math.min(totalTasks, (currentPage - 1) * pageSize + 1)} -{" "}
                  {Math.min(totalTasks, currentPage * pageSize)}
                </strong>{" "}
                trong số{" "}
                <strong className="text-foreground font-semibold tabular-nums">{totalTasks}</strong>{" "}
                nhiệm vụ
              </span>

              <div className="flex items-center gap-1.5 pl-2 border-l border-border/50">
                <span>Số hàng:</span>
                <select
                  aria-label="Số lượng mục trên mỗi trang"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7 rounded-lg border border-border/60 bg-card px-2 text-xs font-medium text-foreground outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Right: Page Navigation Buttons */}
            <div className="flex items-center gap-1 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex h-7 px-2 items-center gap-1 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Trang trước"
              >
                <ChevronLeft className="size-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Trước</span>
              </button>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1">
                {getPageNumbers(currentPage, totalPages).map((p, idx) => {
                  if (p === "...") {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-1 text-muted-foreground"
                      >
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === currentPage;
                  return (
                    <button
                      key={`page-${p}`}
                      type="button"
                      onClick={() => setCurrentPage(Number(p))}
                      className={cn(
                        "size-7 rounded-lg text-xs font-semibold tabular-nums transition-all cursor-pointer",
                        isCurrent
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-7 px-2 items-center gap-1 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Trang kế tiếp"
              >
                <span className="hidden sm:inline">Sau</span>
                <ChevronRight className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card Feed */}
      <div
        className="flex flex-col gap-3 md:hidden"
        role="feed"
        aria-label="Danh sách nhiệm vụ di động"
        style={pullToRefresh.containerProps.style}
        onTouchStart={pullToRefresh.containerProps.onTouchStart}
        onTouchMove={pullToRefresh.containerProps.onTouchMove}
        onTouchEnd={pullToRefresh.containerProps.onTouchEnd}
      >
        {/* Mobile Monthly Indicator Strip */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-card rounded-2xl border border-border/50 text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" strokeWidth={1.5} />
            <span className="font-semibold text-foreground font-mono" data-slot="mobile-monthly-indicator">
              {monthlyIndicatorText}
            </span>
          </div>
          {selectedAcademicMonth !== "ALL" && (
            <span className="text-xs text-muted-foreground font-mono">
              25 - 24
            </span>
          )}
        </div>

        {pullToRefresh.pullDistance > 0 && (
          <div className="flex items-center justify-center py-2 text-xs text-muted-foreground font-medium transition-opacity">
            {pullToRefresh.isRefreshing ? "Đang làm mới..." : "Kéo để làm mới"}
          </div>
        )}
        {filteredTasks.length === 0 ? (
          <div className="p-6 text-center rounded-2xl border border-border/60 bg-card">
            <div className="inline-flex p-3 rounded-2xl bg-muted/60 text-muted-foreground border border-border/60 mb-2">
              <Inbox className="size-8" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              {activeWorkbox === "MY_RECEIVED"
                ? "Hòm việc cá nhân chưa có nhiệm vụ"
                : activeWorkbox === "MY_ASSIGNED"
                ? "Bạn chưa tạo hoặc giao nhiệm vụ nào"
                : "Không tìm thấy nhiệm vụ phù hợp"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {searchQuery
                ? `Không có kết quả khớp với "${searchQuery}".`
                : "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."}
            </p>
          </div>
        ) : (
          paginatedTasks.map((task) => (
            <MobileTaskCard
              key={task.id}
              task={task}
              isExpanded={expandedIds.has(task.id)}
              onToggleExpand={toggleExpand}
              onSelectTask={onSelectTask}
              onStatusChange={onStatusChange}
              selectedAcademicMonth={selectedAcademicMonth}
            />
          ))
        )}

        {/* Mobile Stepper Pagination */}
        {totalTasks > 0 && (
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-card rounded-2xl border border-border/50 text-xs text-muted-foreground shadow-2xs">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex min-h-[44px] px-3.5 items-center gap-1.5 rounded-xl border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors active:scale-95 touch-manipulation"
              title="Trang trước"
            >
              <ChevronLeft className="size-3.5" strokeWidth={1.5} />
              <span>Trước</span>
            </button>
            <span className="font-semibold text-foreground tabular-nums">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex min-h-[44px] px-3.5 items-center gap-1.5 rounded-xl border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors active:scale-95 touch-manipulation"
              title="Trang kế tiếp"
            >
              <span>Sau</span>
              <ChevronRight className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* Mobile Filter BottomSheet */}
      <BottomSheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
        <BottomSheetContent className="p-5 max-h-[85dvh] overflow-y-auto space-y-4">
          <BottomSheetHeader className="p-0 border-b border-border/50 pb-3 flex flex-row items-center justify-between">
            <BottomSheetTitle className="text-base font-bold text-foreground">
              Bộ lọc nhiệm vụ
            </BottomSheetTitle>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDepartment("ALL");
                  setActiveWorkbox("ALL");
                }}
                className="text-xs text-primary font-medium hover:underline cursor-pointer touch-manipulation min-h-[36px] flex items-center"
              >
                Đặt lại tất cả
              </button>
            )}
          </BottomSheetHeader>

          {/* Section 1: Hộp việc */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Hộp việc điều hành
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveWorkbox("ALL")}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer min-h-[44px] touch-manipulation transition-all",
                  activeWorkbox === "ALL"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/70 bg-muted/40 text-foreground"
                )}
              >
                <span>Tất cả</span>
                <span className="font-mono tabular-nums">{workboxCounts.all}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkbox("MY_RECEIVED")}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer min-h-[44px] touch-manipulation transition-all",
                  activeWorkbox === "MY_RECEIVED"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                    : "border-border/70 bg-muted/40 text-foreground"
                )}
              >
                <span>Việc tôi nhận</span>
                <span className="font-mono tabular-nums">{workboxCounts.received}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkbox("MY_ASSIGNED")}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer min-h-[44px] touch-manipulation transition-all",
                  activeWorkbox === "MY_ASSIGNED"
                    ? "border-blue-500 bg-blue-500/10 text-blue-700"
                    : "border-border/70 bg-muted/40 text-foreground"
                )}
              >
                <span>Việc tôi giao</span>
                <span className="font-mono tabular-nums">{workboxCounts.assigned}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkbox("URGENT")}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer min-h-[44px] touch-manipulation transition-all",
                  activeWorkbox === "URGENT"
                    ? "border-rose-500 bg-rose-500/10 text-rose-700"
                    : "border-border/70 bg-muted/40 text-foreground"
                )}
              >
                <span>Khẩn &amp; Chậm</span>
                <span className="font-mono tabular-nums">{workboxCounts.urgent}</span>
              </button>
            </div>
          </div>

          {/* Section 2: Đơn vị thực hiện */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Đơn vị thực hiện
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full h-11 rounded-xl border border-border/70 bg-card px-3 text-xs font-medium text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs"
            >
              {DEPARTMENT_OPTIONS.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.label}
                </option>
              ))}
            </select>
          </div>

          {/* Apply Button */}
          <div className="pt-3 border-t border-border/50">
            <BottomSheetClose asChild>
              <Button
                className="w-full h-11 min-h-[44px] text-xs font-semibold rounded-xl cursor-pointer"
              >
                Áp dụng bộ lọc
              </Button>
            </BottomSheetClose>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}

export default CascadingTaskTable;
