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
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
          "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
      };
    case "TRUYEN_THONG":
      return {
        label: "Truyền thông",
        className:
          "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
      };
    case "CNTT":
      return {
        label: "CNTT",
        className:
          "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
      };
    case "ATTT":
      return {
        label: "An toàn thông tin",
        className:
          "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
      };
    case "THU_VIEN":
      return {
        label: "Thư viện",
        className:
          "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
      };
    case "BAO_CAO":
      return {
        label: "Báo cáo",
        className:
          "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      };
    case "OTHER":
    default:
      return {
        label: "Khác",
        className:
          "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
      };
  }
}

export function getStatusBadgeConfig(
  status: TaskStatus | string
): StatusBadgeConfig {
  switch (status) {
    case "COMPLETED":
      return {
        label: "Hoàn thành",
        className:
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
        variant: "emerald",
      };
    case "IN_PROGRESS":
      return {
        label: "Đang làm",
        className:
          "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
        variant: "sapphire",
      };
    case "NEEDS_REVIEW":
      return {
        label: "Cần duyệt",
        className:
          "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
        variant: "amber",
      };
    case "OVERDUE":
      return {
        label: "Quá hạn",
        className:
          "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
        variant: "rose",
      };
    case "NEW":
    default:
      return {
        label: "Mới giao",
        className:
          "bg-secondary text-muted-foreground border-border/60",
        variant: "secondary",
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
    result = result.filter((task) => {
      const matchSchoolTask =
        resolveDepartmentId(task.leadAssigneeName) === department ||
        task.coAssignees?.some(
          (name) => resolveDepartmentId(name) === department
        );

      const matchSubTasks = task.subTasks?.some(
        (sub) => resolveDepartmentId(sub.assigneeName) === department
      );

      return matchSchoolTask || matchSubTasks;
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
  className?: string;
  hideWorkbox?: boolean;
  hideToolbar?: boolean;
}

export function CascadingTaskTable({
  tasks,
  onSelectTask,
  onAddTask,
  onStatusChange,
  className,
  hideWorkbox = false,
  hideToolbar = false,
}: CascadingTaskTableProps) {
  const { user } = useAuth();
  const { density } = useDisplayDensity();
  const canAssign = canAssignUnitTask(user?.role ?? "ADMIN");
  const [selectedCategory, setSelectedCategory] = React.useState<
    TaskCategory | "ALL"
  >("ALL");
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const [expandedTaskIds, setExpandedTaskIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Keyboard shortcut (⌘K or Ctrl+K) to focus search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
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
            selectedCategory,
            deferredSearchQuery,
            selectedDepartment
          ),
    [hideToolbar, workboxTasks, selectedCategory, deferredSearchQuery, selectedDepartment]
  );

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  // Reset to page 1 whenever workbox, search, department or category filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeWorkbox, selectedCategory, deferredSearchQuery, selectedDepartment]);

  const totalTasks = filteredTasks.length;
  const totalPages = Math.max(1, Math.ceil(totalTasks / pageSize));

  const paginatedTasks = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  return (
    <div
      className={cn("flex flex-col gap-3.5", className)}
      data-slot="cascading-task-table"
    >
      {/* 4 E-Office Workboxes (Hộp việc chuẩn cơ quan với thiết kế Executive Precision) */}
      {!hideWorkbox && (
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-2xl bg-muted/40 border border-border/50 backdrop-blur-xs scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveWorkbox("ALL")}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]",
              activeWorkbox === "ALL"
                ? "bg-card text-foreground font-bold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              Tất cả nhiệm vụ
            </span>
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-mono tabular-nums text-primary font-semibold border border-primary/20">
              {workboxCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkbox("MY_RECEIVED")}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]",
              activeWorkbox === "MY_RECEIVED"
                ? "bg-card text-foreground font-bold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              Việc tôi nhận
            </span>
            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20">
              {workboxCounts.received}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkbox("MY_ASSIGNED")}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]",
              activeWorkbox === "MY_ASSIGNED"
                ? "bg-card text-foreground font-bold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500" />
              Việc tôi giao
            </span>
            <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-xs font-mono tabular-nums text-blue-700 dark:text-blue-400 font-semibold border border-blue-500/20">
              {workboxCounts.assigned}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkbox("URGENT")}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]",
              activeWorkbox === "URGENT"
                ? "bg-card text-rose-700 dark:text-rose-400 font-bold shadow-xs border border-rose-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
              Khẩn &amp; Chậm tiến độ
            </span>
            {workboxCounts.urgent > 0 && (
              <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-xs font-mono tabular-nums text-rose-700 dark:text-rose-400 font-semibold border border-rose-500/30">
                {workboxCounts.urgent}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Control Bar: Category Tabs & Search */}
      {!hideToolbar && (
        <>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
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

              {/* Search Box with ⌘K Shortcut */}
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
                  className="h-9.5 w-full rounded-xl border border-border/70 bg-card pl-9 pr-14 text-xs text-foreground placeholder:text-muted-foreground/60 transition-all hover:border-border focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 shadow-2xs"
                />
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5">
                  <kbd className="rounded border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    ⌘K
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

          {/* Category Filter Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const isSelected = selectedCategory === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap active:scale-95",
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "border border-border/60 bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {Icon && <Icon className="size-3.5" strokeWidth={1.5} />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Main Table Container */}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-row-dense">
            {/* Table Header */}
            <thead>
              <tr className="h-11 border-b border-border/50 bg-muted/40">
                <th className="w-9 h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground text-center">
                  <span className="sr-only">Mở rộng</span>
                </th>
                <th className="w-24 h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">Mã NV</th>
                <th className="h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">Nhiệm vụ cấp Trường</th>
                <th className="h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">Danh mục</th>
                <th className="h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">Chủ trì</th>
                <th className="h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">Hạn chót</th>
                <th className="w-56 h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Tiến độ &amp; Thao tác</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border/50">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
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
                              setSelectedCategory("ALL");
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
                              : "Thử thay đổi bộ lọc đơn vị hoặc chọn danh mục công việc khác."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory("ALL");
                            setSelectedDepartment("ALL");
                            setSearchQuery("");
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
                  const catConfig = getCategoryBadgeConfig(task.category);

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
                                isExpanded ? "Thu gọn việc con" : "Mở rộng việc con"
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
                          <div className="flex items-center gap-2">
                            <span className="line-clamp-1 text-sm font-medium text-foreground leading-snug">{task.title}</span>
                            {hasSubtasks && (
                              <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                                {task.completedSubTasks}/{task.totalSubTasks}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category Badge */}
                        <td className={cn("table-cell-dense px-4 align-middle whitespace-nowrap", density === "compact" ? "py-1.5" : "py-3")}>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5.5 px-2.5 text-xs font-semibold tabular-nums leading-none",
                              catConfig.className
                            )}
                          >
                            {catConfig.label}
                          </Badge>
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
                            {/* Micro-ghost Quick Actions revealed on row hover */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              {onStatusChange && task.status === "IN_PROGRESS" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onStatusChange(task.id, "COMPLETED");
                                  }}
                                  className="inline-flex h-6 items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer active:scale-[0.98] transition-colors"
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
                                  className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer active:scale-[0.98] transition-colors"
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
                                  title="Phân công thêm việc con"
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
                                  className="h-full bg-blue-500/30 dark:bg-blue-400/30 transition-all duration-500 ease-out"
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
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
                                onStatusChange && "cursor-pointer transition-transform hover:scale-105 active:scale-95"
                              )}
                            >
                              {task.status === "COMPLETED" ? "Hoàn thành" : "Đang làm"}
                            </Badge>
                          </div>
                        </td>
                      </tr>

                      {/* Tier 2 Nested Container (Sub-tasks) */}
                      {isExpanded && hasSubtasks && (
                        <tr>
                          <td
                            colSpan={7}
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
                                      className="group/sub flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs transition-colors hover:bg-secondary/60 focus-visible:outline-hidden focus-visible:bg-secondary/70 cursor-pointer"
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
                                              "cursor-pointer transition-transform hover:scale-105 active:scale-95",
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

                                        {/* 1-Click Fast Workflow Action for Subtask */}
                                        {onStatusChange && (
                                          <div className="shrink-0 opacity-0 group-hover/sub:opacity-100 transition-opacity duration-150">
                                            {subTask.status === "NEW" && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onStatusChange(subTask.id, "IN_PROGRESS");
                                                }}
                                                className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-semibold tabular-nums border border-blue-500/20 cursor-pointer active:scale-[0.98] transition-colors"
                                                title="Tiếp nhận việc này"
                                              >
                                                <ArrowRight className="size-3" strokeWidth={1.5} />
                                                <span>Nhận việc</span>
                                              </button>
                                            )}
                                            {subTask.status === "IN_PROGRESS" && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onStatusChange(subTask.id, "COMPLETED");
                                                }}
                                                className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold tabular-nums border border-emerald-500/20 cursor-pointer active:scale-[0.98] transition-colors"
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
                                                className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-semibold tabular-nums border border-amber-500/20 cursor-pointer active:scale-[0.98] transition-colors"
                                                title="Tiếp nhận sửa lại"
                                              >
                                                <RotateCcw className="size-3" strokeWidth={1.5} />
                                                <span>Sửa lại</span>
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
    </div>
  );
}

export default CascadingTaskTable;
