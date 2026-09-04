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
    | "warning";
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
        label: "Mới 🆕",
        className:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
        variant: "destructive",
      };
    case "IN_PROGRESS":
      return {
        label: "Đang thực hiện 🔨",
        className:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
        variant: "progress",
      };
    case "NEEDS_REVIEW":
      return {
        label: "Cần chỉnh sửa ⚠️",
        className:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        variant: "warning",
      };
    case "COMPLETED":
      return {
        label: "Hoàn thành 👍",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        variant: "success",
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
  searchQuery: string
): SchoolTask[] {
  const query = searchQuery.trim().toLowerCase();

  return tasks.filter((task) => {
    if (category !== "ALL" && task.category !== category) {
      return false;
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
  const [selectedCategory, setSelectedCategory] = React.useState<
    TaskCategory | "ALL"
  >("ALL");
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
    () => filterTasksForTable(tasks, selectedCategory, searchQuery),
    [tasks, selectedCategory, searchQuery]
  );

  return (
    <div
      className={cn("flex flex-col gap-3.5", className)}
      data-slot="cascading-task-table"
    >
      {/* Top Filter Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side: Search & Category Tabs */}
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
          {/* Search Input with ⌘K indicator */}
          <div className="relative min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Tìm kiếm nhiệm vụ, phụ trách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-md border border-border/80 bg-background pl-8 pr-12 text-xs text-foreground placeholder:text-muted-foreground transition-colors focus:border-border focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 inline-flex h-4 -translate-y-1/2 select-none items-center gap-0.5 rounded border border-border/80 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const isActive = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center rounded-md px-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap",
                    isActive
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right side: + Giao việc primary button */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            onClick={onAddTask}
            className="h-8 rounded-md px-3 text-xs font-medium shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Giao việc</span>
          </Button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-medium text-muted-foreground">
                <th className="w-8 px-3 py-2 text-center">
                  <span className="sr-only">Mở rộng</span>
                </th>
                <th className="px-3 py-2 font-medium">Nhiệm vụ cấp Trường</th>
                <th className="px-3 py-2 font-medium">Danh mục</th>
                <th className="px-3 py-2 font-medium">Chủ trì</th>
                <th className="px-3 py-2 font-medium">Hạn chót</th>
                <th className="w-36 px-3 py-2 font-medium text-right">Tiến độ</th>
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
                          "group cursor-pointer transition-colors hover:bg-secondary/40 focus-visible:outline-hidden focus-visible:bg-secondary/50",
                          isExpanded && "bg-muted/20"
                        )}
                        data-task-id={task.id}
                        data-task-tier="1"
                      >
                        {/* Expand / Collapse Caret */}
                        <td className="px-3 py-3 text-center align-middle">
                          {hasSubtasks ? (
                            <button
                              type="button"
                              onClick={(e) => toggleExpand(task.id, e)}
                              className="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
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
                        <td className="px-3 py-3 align-middle font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="line-clamp-1">{task.title}</span>
                            {hasSubtasks && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                                {task.completedSubTasks}/{task.totalSubTasks}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category Badge */}
                        <td className="px-3 py-3 align-middle whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 px-1.5 text-[10px] font-medium leading-none",
                              catConfig.className
                            )}
                          >
                            {catConfig.label}
                          </Badge>
                        </td>

                        {/* Lead Assignee */}
                        <td className="px-3 py-3 align-middle whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {task.leadAssigneeAvatar ? (
                              <img
                                src={task.leadAssigneeAvatar}
                                alt={task.leadAssigneeName}
                                width={20}
                                height={20}
                                loading="lazy"
                                className="size-5 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
                                {getInitials(task.leadAssigneeName)}
                              </span>
                            )}
                            <span className="text-xs text-foreground/90">
                              {task.leadAssigneeName}
                            </span>
                          </div>
                        </td>

                        {/* Due Date */}
                        <td className="px-3 py-3 align-middle whitespace-nowrap text-muted-foreground tabular-nums">
                          {formatDate(task.dueDate)}
                        </td>

                        {/* Progress Bar & Metric */}
                        <td className="px-3 py-3 align-middle text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2.5">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, task.progressPercent)
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-medium tabular-nums text-foreground">
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
                            <div className="py-2 pr-4 pl-[28px]">
                              <div className="border-l border-border/80 pl-4 space-y-1.5">
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
                                      className="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-xs transition-colors hover:bg-secondary/60 focus-visible:outline-hidden focus-visible:bg-secondary/70 cursor-pointer"
                                      data-subtask-id={subTask.id}
                                    >
                                      {/* Subtask Status Badge & Title */}
                                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <Badge
                                          variant={statusConfig.variant}
                                          className={cn(
                                            "h-5 px-1.5 text-[10px] font-medium leading-none shrink-0",
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
                                              width={16}
                                              height={16}
                                              loading="lazy"
                                              className="size-4 rounded-full object-cover shrink-0"
                                            />
                                          ) : (
                                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-medium text-secondary-foreground">
                                              {getInitials(subTask.assigneeName)}
                                            </span>
                                          )}
                                          <span className="text-[11px] text-muted-foreground">
                                            {subTask.assigneeName}
                                          </span>
                                        </div>
                                        <span className="text-[11px] text-muted-foreground/80 tabular-nums">
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
