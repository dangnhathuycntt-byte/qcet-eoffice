import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
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

export interface CascadingTaskTableProps {
  tasks: SchoolTask[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onAddTask?: () => void;
  className?: string;
}

export function CascadingTaskTable({
  tasks,
  onSelectTask,
  onAddTask,
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

  const filteredTasks = React.useMemo(
    () =>
      filterTasksForTable(
        tasks,
        selectedCategory,
        searchQuery,
        selectedDepartment
      ),
    [tasks, selectedCategory, searchQuery, selectedDepartment]
  );

  return (
    <div
      className={cn("flex flex-col gap-3.5", className)}
      data-slot="cascading-task-table"
    >
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

        {/* Right side: + Giao việc primary button */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <Button
            type="button"
            onClick={canAssign ? onAddTask : undefined}
            disabled={!canAssign}
            title={
              !canAssign
                ? "Chỉ BGH và Trưởng đơn vị mới có quyền giao việc"
                : undefined
            }
            className={cn(
              "h-8.5 rounded-xl px-3.5 text-xs font-semibold shadow-xs",
              canAssign
                ? "cursor-pointer"
                : "opacity-50 cursor-not-allowed"
            )}
          >
            <Plus className="size-3.5" />
            <span>Giao việc</span>
          </Button>
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
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
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
                                alt={task.leadAssigneeName}
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
                                          className={cn(
                                            "h-5 px-2 text-[10px] font-semibold leading-none shrink-0",
                                            statusConfig.className
                                          )}
                                        >
                                          {statusConfig.label}
                                        </Badge>
                                        <span className="truncate text-foreground/90 font-medium">
                                          {subTask.title}
                                        </span>
                                      </div>

                                      {/* Subtask Assignee & Due Date */}
                                      <div className="flex items-center gap-4 shrink-0">
                                        <div className="flex items-center gap-1.5">
                                          {subTask.assigneeAvatar ? (
                                            <img
                                              src={subTask.assigneeAvatar}
                                              alt={subTask.assigneeName}
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
      </div>
    </div>
  );
}

export default CascadingTaskTable;
