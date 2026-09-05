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
} from "lucide-react";
import type {
  SchoolTask,
  StaffTask,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import { useAuth } from "@/lib/auth-context";
import { canAssignUnitTask } from "@/lib/role-task-filter";
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
}

export const CATEGORY_TABS: CategoryTab[] = [
  { id: "ALL", label: "Tất cả" },
  { id: "CHUYEN_DOI_SO", label: "Chuyển đổi số" },
  { id: "TRUYEN_THONG", label: "Truyền thông" },
  { id: "CNTT", label: "CNTT" },
  { id: "ATTT", label: "An toàn thông tin" },
  { id: "THU_VIEN", label: "Thư viện" },
  { id: "BAO_CAO", label: "Báo cáo" },
];

export const DEPARTMENT_OPTIONS = [
  { id: "ALL", label: "Tất cả đơn vị" },
  { id: "CNTT", label: "Khoa CNTT" },
  { id: "DAO_TAO", label: "Phòng Đào tạo & QLKH" },
  { id: "TRUYEN_THONG", label: "Tổ Truyền thông" },
  { id: "THU_VIEN", label: "Thư viện & Học liệu" },
  { id: "HANH_CHINH", label: "Phòng Hành chính - Quản trị" },
];

export function getCategoryBadgeConfig(
  category: TaskCategory | string
): CategoryBadgeConfig {
  switch (category) {
    case "CHUYEN_DOI_SO":
      return {
        label: "Chuyển đổi số",
        className:
          "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
      };
    case "TRUYEN_THONG":
      return {
        label: "Truyền thông",
        className:
          "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
      };
    case "CNTT":
      return {
        label: "CNTT",
        className:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
      };
    case "ATTT":
      return {
        label: "An toàn thông tin",
        className:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
      };
    case "THU_VIEN":
      return {
        label: "Thư viện",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
      };
    case "BAO_CAO":
      return {
        label: "Báo cáo",
        className:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      };
    case "KHAC":
    default:
      return {
        label: "Khác",
        className:
          "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
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
          "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
        variant: "destructive",
      };
    case "IN_PROGRESS":
      return {
        label: "Đang thực hiện",
        className:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        variant: "sapphire",
      };
    case "NEEDS_REVIEW":
      return {
        label: "Cần chỉnh sửa",
        className:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        variant: "amber",
      };
    case "COMPLETED":
      return {
        label: "Hoàn thành",
        className:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        variant: "emerald",
      };
    default:
      return {
        label: status || "Chưa rõ",
        className:
          "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
        variant: "outline",
      };
  }
}

export function filterTasksForTable(
  tasks: SchoolTask[],
  category: TaskCategory | "ALL",
  searchQuery: string,
  department?: string
): SchoolTask[] {
  const query = searchQuery.trim().toLowerCase();

  return tasks.filter((task) => {
    if (category !== "ALL" && task.category !== category) {
      return false;
    }

    if (department && department !== "ALL") {
      const deptQuery = department.toLowerCase();
      const isDeptMatch =
        (department === "CNTT" &&
          (task.category === "CNTT" ||
            task.category === "ATTT" ||
            task.category === "CHUYEN_DOI_SO" ||
            task.leadAssigneeName.includes("Vinh") ||
            task.leadAssigneeName.includes("Hùng"))) ||
        (department === "TRUYEN_THONG" &&
          (task.category === "TRUYEN_THONG" ||
            task.leadAssigneeName.includes("Xuân"))) ||
        (department === "THU_VIEN" &&
          (task.category === "THU_VIEN" ||
            task.leadAssigneeName.includes("Thu"))) ||
        (department === "DAO_TAO" &&
          (task.leadAssigneeName.includes("Hùng") ||
            task.category === "BAO_CAO")) ||
        (department === "HANH_CHINH" && task.leadAssigneeName.includes("Nam")) ||
        task.leadAssigneeName.toLowerCase().includes(deptQuery) ||
        task.subTasks?.some((st) =>
          st.assigneeName.toLowerCase().includes(deptQuery)
        );

      if (!isDeptMatch) return false;
    }

    if (!query) {
      return true;
    }

    const matchTitle = task.title.toLowerCase().includes(query);
    const matchLead = task.leadAssigneeName.toLowerCase().includes(query);
    const matchSubtask = task.subTasks?.some(
      (st) =>
        st.title.toLowerCase().includes(query) ||
        st.assigneeName.toLowerCase().includes(query)
    );

    return matchTitle || matchLead || matchSubtask;
  });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
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

function getInitials(name: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export type WorkboxFilter = "ALL" | "MY_RECEIVED" | "MY_ASSIGNED" | "URGENT";

export interface CascadingTaskTableProps {
  tasks: SchoolTask[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onAddTask?: () => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  className?: string;
}

export function CascadingTaskTable({
  tasks,
  onSelectTask,
  onAddTask,
  onStatusChange,
  className,
}: CascadingTaskTableProps) {
  const { user } = useAuth();
  const canAssign = canAssignUnitTask(user?.role ?? "ADMIN");
  const [selectedCategory, setSelectedCategory] = React.useState<
    TaskCategory | "ALL"
  >("ALL");
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
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
    if (activeWorkbox === "ALL") return tasks;
    const userName = user?.name?.toLowerCase() || "";
    const today = new Date("2026-09-04T00:00:00");

    // ADMIN (BGH) sees all tasks in "Việc tôi giao/nhận" context
    if (user?.role === "ADMIN") {
      if (activeWorkbox === "MY_RECEIVED" || activeWorkbox === "MY_ASSIGNED") {
        return tasks;
      }
      if (activeWorkbox === "URGENT") {
        return tasks.filter((t) => {
          const isPastDue =
            t.dueDate &&
            new Date(t.dueDate.split("T")[0] + "T00:00:00") < today &&
            t.status !== "COMPLETED";
          const hasSubUrgent = t.subTasks?.some((s) => {
            const sPast =
              s.dueDate &&
              new Date(s.dueDate.split("T")[0] + "T00:00:00") < today &&
              s.status !== "COMPLETED";
            return sPast || s.status === "NEEDS_REVIEW";
          });
          return isPastDue || hasSubUrgent;
        });
      }
      return tasks;
    }

    if (activeWorkbox === "MY_RECEIVED") {
      return tasks.filter((t) => {
        const isLead = t.leadAssigneeName.toLowerCase().includes(userName);
        const isCo = t.coAssignees?.some((c) =>
          c.toLowerCase().includes(userName)
        );
        const hasSub = t.subTasks?.some((s) =>
          s.assigneeName.toLowerCase().includes(userName)
        );
        return isLead || isCo || hasSub;
      });
    }

    if (activeWorkbox === "MY_ASSIGNED") {
      return tasks.filter((t) =>
        t.leadAssigneeName.toLowerCase().includes(userName)
      );
    }

    if (activeWorkbox === "URGENT") {
      return tasks.filter((t) => {
        const isPastDue =
          t.dueDate &&
          new Date(t.dueDate.split("T")[0] + "T00:00:00") < today &&
          t.status !== "COMPLETED";
        const hasSubUrgent = t.subTasks?.some((s) => {
          const sPast =
            s.dueDate &&
            new Date(s.dueDate.split("T")[0] + "T00:00:00") < today &&
            s.status !== "COMPLETED";
          return sPast || s.status === "NEEDS_REVIEW";
        });
        return isPastDue || hasSubUrgent;
      });
    }

    return tasks;
  }, [tasks, activeWorkbox, user]);

  // Compute workbox counts for badge numbers
  const workboxCounts = React.useMemo(() => {
    const userName = user?.name?.toLowerCase() || "";
    const today = new Date("2026-09-04T00:00:00");
    const isAdmin = user?.role === "ADMIN";

    let received = 0;
    let assigned = 0;
    let urgent = 0;

    for (const t of tasks) {
      const isLead = t.leadAssigneeName.toLowerCase().includes(userName);
      const isCo = t.coAssignees?.some((c) =>
        c.toLowerCase().includes(userName)
      );
      const hasSub = t.subTasks?.some((s) =>
        s.assigneeName.toLowerCase().includes(userName)
      );
      // ADMIN sees all tasks in their "received" box
      if (isAdmin || isLead || isCo || hasSub) received++;
      if (isAdmin || isLead) assigned++;

      const isPastDue =
        t.dueDate &&
        new Date(t.dueDate.split("T")[0] + "T00:00:00") < today &&
        t.status !== "COMPLETED";
      const hasSubUrgent = t.subTasks?.some((s) => {
        const sPast =
          s.dueDate &&
          new Date(s.dueDate.split("T")[0] + "T00:00:00") < today &&
          s.status !== "COMPLETED";
        return sPast || s.status === "NEEDS_REVIEW";
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
      filterTasksForTable(
        workboxTasks,
        selectedCategory,
        searchQuery,
        selectedDepartment
      ),
    [workboxTasks, selectedCategory, searchQuery, selectedDepartment]
  );

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  // Reset to page 1 whenever workbox, search, department or category filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeWorkbox, selectedCategory, searchQuery, selectedDepartment]);

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
      {/* 4 E-Office Workboxes (Hộp việc chuẩn cơ quan) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveWorkbox("ALL")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap",
            activeWorkbox === "ALL"
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "border-border/60 bg-card/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <span>📋 Tất cả công việc</span>
          <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] font-mono tabular-nums text-foreground/80">
            {workboxCounts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveWorkbox("MY_RECEIVED")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap",
            activeWorkbox === "MY_RECEIVED"
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "border-border/60 bg-card/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <span>📥 Việc tôi nhận</span>
          <span className="rounded-md bg-blue-500/15 px-1.5 py-0.2 text-[10px] font-mono tabular-nums text-blue-600 dark:text-blue-400 font-bold">
            {workboxCounts.received}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveWorkbox("MY_ASSIGNED")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap",
            activeWorkbox === "MY_ASSIGNED"
              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
              : "border-border/60 bg-card/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <span>📤 Việc tôi giao</span>
          <span className="rounded-md bg-indigo-500/15 px-1.5 py-0.2 text-[10px] font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-bold">
            {workboxCounts.assigned}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveWorkbox("URGENT")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap",
            activeWorkbox === "URGENT"
              ? "bg-rose-600 text-white border-rose-600 shadow-xs"
              : "border-border/60 bg-card/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <span>⚠️ Cần xử lý gấp & Quá hạn</span>
          {workboxCounts.urgent > 0 && (
            <span className="rounded-md bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-mono tabular-nums text-rose-600 dark:text-rose-400 font-bold">
              {workboxCounts.urgent}
            </span>
          )}
        </button>
      </div>

      {/* Top Filter Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side: Search & Department selector */}
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center flex-wrap">
          {/* Search Input with ⌘K indicator */}
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Tìm kiếm nhiệm vụ, phụ trách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 w-full rounded-xl border border-border/60 bg-background/80 backdrop-blur-xs pl-8.5 pr-12 text-xs text-foreground placeholder:text-muted-foreground transition-all focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 inline-flex h-4.5 -translate-y-1/2 select-none items-center gap-0.5 rounded border border-border/80 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          {/* Department Selector */}
          <div className="relative min-w-[160px]">
            <select
              aria-label="Lọc theo đơn vị"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="h-8.5 w-full rounded-xl border border-border/60 bg-background/80 backdrop-blur-xs px-3 py-1 text-xs text-foreground transition-all focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15 cursor-pointer appearance-none pr-8"
            >
              {DEPARTMENT_OPTIONS.map((dept) => (
                <option
                  key={dept.id}
                  value={dept.id}
                  className="bg-popover text-foreground"
                >
                  {dept.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Category Tabs Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
        {CATEGORY_TABS.map((tab) => {
          const isActive = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id)}
              className={cn(
                "inline-flex h-7.5 shrink-0 items-center rounded-lg px-3 text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Table Container */}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-border/50 bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                <th className="w-9 px-3.5 py-2.5 text-center">
                  <span className="sr-only">Mở rộng</span>
                </th>
                <th className="px-3.5 py-2.5 font-semibold">Nhiệm vụ cấp Trường</th>
                <th className="px-3.5 py-2.5 font-semibold">Danh mục</th>
                <th className="px-3.5 py-2.5 font-semibold">Chủ trì</th>
                <th className="px-3.5 py-2.5 font-semibold">Hạn chót</th>
                <th className="w-40 px-3.5 py-2.5 font-semibold text-right">Tiến độ</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border/50">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <ListTodo className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                    <p className="font-medium text-foreground text-sm">
                      Không tìm thấy nhiệm vụ nào
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory("ALL");
                        setSelectedDepartment("ALL");
                        setSearchQuery("");
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
                    >
                      Xóa bộ lọc & Xem tất cả
                    </button>
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
                          "group cursor-pointer transition-all duration-200 hover:bg-secondary/40 focus-visible:outline-hidden focus-visible:bg-secondary/50",
                          isExpanded && "bg-muted/20"
                        )}
                        data-task-id={task.id}
                        data-task-tier="1"
                      >
                        {/* Expand / Collapse Caret */}
                        <td className="px-3.5 py-3.5 text-center align-middle">
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
                                <ChevronDown className="size-3.5" />
                              ) : (
                                <ChevronRight className="size-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="inline-block size-1.5 rounded-full bg-border" />
                          )}
                        </td>

                        {/* Task Title */}
                        <td className="px-3.5 py-3.5 align-middle font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="line-clamp-1 font-semibold">{task.title}</span>
                            {hasSubtasks && (
                              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {task.completedSubTasks}/{task.totalSubTasks}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category Badge */}
                        <td className="px-3.5 py-3.5 align-middle whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 px-2 text-[10px] font-medium leading-none",
                              catConfig.className
                            )}
                          >
                            {catConfig.label}
                          </Badge>
                        </td>

                        {/* Lead Assignee */}
                        <td className="px-3.5 py-3.5 align-middle whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {task.leadAssigneeAvatar ? (
                              <img
                                src={task.leadAssigneeAvatar}
                                alt=""
                                aria-hidden="true"
                                width={22}
                                height={22}
                                loading="lazy"
                                className="size-5.5 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
                                {getInitials(task.leadAssigneeName)}
                              </span>
                            )}
                            <span className="text-xs font-medium text-foreground/90">
                              {task.leadAssigneeName}
                            </span>
                          </div>
                        </td>

                        {/* Due Date */}
                        <td className="px-3.5 py-3.5 align-middle whitespace-nowrap text-muted-foreground tabular-nums">
                          {formatDate(task.dueDate)}
                        </td>

                        {/* Progress Bar & Metric with Segmented Emerald/Sapphire Track */}
                        <td className="px-3.5 py-3.5 align-middle text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2.5">
                            <div className="relative flex h-2 w-20 overflow-hidden rounded-full bg-secondary/80">
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
                            <span className="text-[11px] font-bold tabular-nums text-foreground">
                              {task.progressPercent}%
                            </span>

                            {/* 1-Click Fast Workflow Action Button */}
                            {onStatusChange && task.status === "IN_PROGRESS" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStatusChange(task.id, "COMPLETED");
                                }}
                                className="hidden sm:inline-flex h-6 px-2 items-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[10.5px] font-semibold border border-emerald-500/20 cursor-pointer transition-colors"
                                title="Báo cáo hoàn thành nhiệm vụ"
                              >
                                Báo cáo xong ✓
                              </button>
                            )}

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
                                "h-5 px-2 text-[10px] font-semibold leading-none shrink-0",
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
                                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs transition-colors hover:bg-secondary/60 focus-visible:outline-hidden focus-visible:bg-secondary/70 cursor-pointer"
                                      data-subtask-id={subTask.id}
                                    >
                                      {/* Subtask Status Badge & Title */}
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
                                            "h-5 px-2 text-[10px] font-semibold leading-none shrink-0",
                                            onStatusChange &&
                                              "cursor-pointer transition-transform hover:scale-105 active:scale-95",
                                            statusConfig.className
                                          )}
                                        >
                                          {statusConfig.label}
                                        </Badge>
                                        <span className="truncate text-foreground/90 font-medium">
                                          {subTask.title}
                                        </span>

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
                                                className="h-5 px-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-[10px] font-semibold border border-blue-500/20 cursor-pointer"
                                                title="Tiếp nhận việc này"
                                              >
                                                Nhận 📥
                                              </button>
                                            )}
                                            {subTask.status === "IN_PROGRESS" && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onStatusChange(subTask.id, "COMPLETED");
                                                }}
                                                className="h-5 px-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-semibold border border-emerald-500/20 cursor-pointer"
                                                title="Báo cáo hoàn thành"
                                              >
                                                Xong ✓
                                              </button>
                                            )}
                                            {subTask.status === "NEEDS_REVIEW" && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onStatusChange(subTask.id, "IN_PROGRESS");
                                                }}
                                                className="h-5 px-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-[10px] font-semibold border border-amber-500/20 cursor-pointer"
                                                title="Tiếp nhận sửa lại"
                                              >
                                                Sửa ✏️
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
                                              width={18}
                                              height={18}
                                              loading="lazy"
                                              className="size-4.5 rounded-full object-cover shrink-0"
                                            />
                                          ) : (
                                            <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold text-secondary-foreground">
                                              {getInitials(subTask.assigneeName)}
                                            </span>
                                          )}
                                          <span className="text-[11px] font-medium text-muted-foreground">
                                            {subTask.assigneeName}
                                          </span>
                                        </div>
                                        <span className="text-[11px] text-muted-foreground/80 tabular-nums font-mono">
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
                <strong className="text-foreground font-semibold">
                  {Math.min(totalTasks, (currentPage - 1) * pageSize + 1)} -{" "}
                  {Math.min(totalTasks, currentPage * pageSize)}
                </strong>{" "}
                trong số{" "}
                <strong className="text-foreground font-semibold">{totalTasks}</strong>{" "}
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
                <ChevronLeft className="size-3.5" />
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
                        "size-7 rounded-lg text-xs font-semibold transition-all cursor-pointer",
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
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CascadingTaskTable;
