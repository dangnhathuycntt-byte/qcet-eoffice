"use client";

import * as React from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Layers,
  ArrowUpRight,
  Maximize2,
  Minimize2,
  ShieldCheck,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { DelegationRule } from "@/types/delegation";
import { isDelegationActive } from "@/lib/delegation-authority-engine";
import {
  aggregateTasksByDepartment,
  type DepartmentTaskGroup,
  type DepartmentRAGStatus,
} from "@/lib/department-task-aggregator";
import { QCET_DEPARTMENTS } from "@/components/org/organization-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DepartmentGroupedTaskViewProps {
  tasks: SchoolTask[];
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask?: (departmentCode?: string) => void;
  selectedDepartmentFilter?: string;
  searchQuery?: string;
  onManageDelegation?: (departmentCode: string) => void;
  delegations?: DelegationRule[];
}

function RAGBadge({ status, reason }: { status: DepartmentRAGStatus; reason: string }) {
  if (status === "RED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900/60 font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
        Cảnh báo trễ ({reason})
      </span>
    );
  }
  if (status === "AMBER") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/60 font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Cần lưu ý
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/60 font-mono">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Bình thường
    </span>
  );
}

function formatTaskStatus(
  status: string,
  dueDate?: string,
  referenceDate: string = "2026-09-06"
): {
  label: string;
  className: string;
} {
  const isOverdue = status !== "COMPLETED" && !!dueDate && dueDate < referenceDate;

  if (isOverdue) {
    return {
      label: "Quá hạn",
      className:
        "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900/60",
    };
  }

  switch (status) {
    case "COMPLETED":
      return {
        label: "Hoàn thành",
        className:
          "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/60",
      };
    case "PENDING_EXECUTIVE_APPROVAL":
      return {
        label: "Chờ BGH duyệt",
        className:
          "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-900/60",
      };
    case "NEEDS_REVIEW":
      return {
        label: "Cần đánh giá",
        className:
          "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/60",
      };
    case "BLOCKED":
      return {
        label: "Bị nghẽn",
        className:
          "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900/60",
      };
    case "IN_PROGRESS":
      return {
        label: "Đang thực hiện",
        className:
          "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/60",
      };
    case "NEW":
    default:
      return {
        label: "Mới giao",
        className:
          "bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
      };
  }
}

export function DepartmentGroupedTaskView({
  tasks,
  onSelectTask,
  onStatusChange,
  onAddTask,
  selectedDepartmentFilter = "ALL",
  searchQuery = "",
  onManageDelegation,
  delegations = [],
}: DepartmentGroupedTaskViewProps) {
  const [expandedDeptIds, setExpandedDeptIds] = React.useState<Set<string>>(() => {
    // Mặc định mở rộng 3 đơn vị đầu tiên
    return new Set(QCET_DEPARTMENTS.slice(0, 3).map((d) => d.id));
  });

  const departmentGroups = React.useMemo(() => {
    let groups = aggregateTasksByDepartment(tasks, QCET_DEPARTMENTS);

    // Lọc theo selectedDepartmentFilter nếu có
    if (selectedDepartmentFilter && selectedDepartmentFilter !== "ALL") {
      groups = groups.filter(
        (g) =>
          g.departmentCode.toUpperCase() === selectedDepartmentFilter.toUpperCase() ||
          g.departmentId.toUpperCase() === selectedDepartmentFilter.toUpperCase()
      );
    }

    // Lọc theo searchQuery nếu có
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      groups = groups.filter((g) => {
        const matchDept =
          g.departmentName.toLowerCase().includes(q) ||
          g.departmentCode.toLowerCase().includes(q) ||
          g.leaderName.toLowerCase().includes(q);
        const matchTask = g.allTasks.some((t) => t.title.toLowerCase().includes(q));
        return matchDept || matchTask;
      });
    }

    return groups;
  }, [tasks, selectedDepartmentFilter, searchQuery]);

  const toggleDept = (id: string) => {
    setExpandedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedDeptIds(new Set(departmentGroups.map((g) => g.departmentId)));
  };

  const collapseAll = () => {
    setExpandedDeptIds(new Set());
  };

  return (
    <div className="space-y-4" data-slot="department-grouped-task-view">
      {/* Thanh điều khiển phụ: Expand/Collapse All & Tóm tắt số đơn vị */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Building2 size={16} strokeWidth={1.5} className="text-primary" />
          <span className="text-xs font-semibold text-foreground font-mono tabular-nums">
            {departmentGroups.length} đơn vị giám sát
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={expandAll}
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <Maximize2 size={12} strokeWidth={1.5} />
            Mở rộng tất cả
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <Minimize2 size={12} strokeWidth={1.5} />
            Thu gọn
          </Button>
        </div>
      </div>

      {/* Danh sách các khối đơn vị dạng Accordion */}
      <div className="space-y-3">
        {departmentGroups.map((group) => {
          const isExpanded = expandedDeptIds.has(group.departmentId);
          const activeDelegationCount = delegations
            ? delegations.filter((d) => {
                const dCode = (d.departmentCode || "").toUpperCase();
                const deptCodeNorm = group.departmentCode.toUpperCase();
                const matchesDept =
                  dCode === deptCodeNorm ||
                  dCode.replace(/^(K_|P_|TT_)/, "") === deptCodeNorm.replace(/^(K_|P_|TT_)/, "");
                return matchesDept && isDelegationActive(d);
              }).length
            : 0;

          return (
            <div
              key={group.departmentId}
              className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs transition-all shadow-xs overflow-hidden"
            >
              {/* Header của Đơn vị */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/40 transition-colors">
                {/* Semantic WAI-ARIA Accordion Toggle Button */}
                <button
                  type="button"
                  id={`dept-trigger-${group.departmentId}`}
                  aria-expanded={isExpanded}
                  aria-controls={`dept-panel-${group.departmentId}`}
                  onClick={() => toggleDept(group.departmentId)}
                  className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left cursor-pointer select-none group/trigger focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded-lg p-0.5"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span
                      className="p-1 rounded-md text-muted-foreground group-hover/trigger:text-foreground group-hover/trigger:bg-muted shrink-0 mt-0.5 sm:mt-0 transition-colors"
                      aria-hidden="true"
                    >
                      {isExpanded ? (
                        <ChevronDown size={18} strokeWidth={1.5} />
                      ) : (
                        <ChevronRight size={18} strokeWidth={1.5} />
                      )}
                    </span>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20 font-mono">
                          {group.departmentCode}
                        </span>
                        <h3 className="text-sm font-bold text-foreground font-heading">
                          {group.departmentName}
                        </h3>
                        <RAGBadge
                          status={group.stats.ragStatus}
                          reason={group.stats.ragReason}
                        />
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <UserCheck size={13} strokeWidth={1.5} className="text-primary/70" />
                          {group.leaderRole}: {group.leaderName}
                        </span>
                        <span>•</span>
                        <span className="font-mono tabular-nums">
                          {group.stats.totalTasks} nhiệm vụ ({group.stats.schoolTasksCount} cấp trường,{" "}
                          {group.stats.unitTasksCount} cấp đơn vị)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar & quick metrics */}
                  <div className="w-32 sm:w-40 space-y-1 shrink-0 pl-7 sm:pl-0 sm:self-center mr-0 sm:mr-3">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="text-muted-foreground">Tiến độ</span>
                      <span className="font-bold text-foreground">
                        {group.stats.averageProgress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          group.stats.ragStatus === "RED"
                            ? "bg-rose-500"
                            : group.stats.ragStatus === "AMBER"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        )}
                        style={{ width: `${group.stats.averageProgress}%` }}
                      />
                    </div>
                  </div>
                </button>

                {/* Action Area: Delegation & Task Creation safely outside the toggle button */}
                <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0 sm:self-center">
                  {onManageDelegation && (
                    <div className="flex items-center gap-1.5">
                      {activeDelegationCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-900/60 font-mono">
                          {activeDelegationCount} ủy quyền
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onManageDelegation(group.departmentCode);
                        }}
                        className="h-8 px-2.5 text-xs gap-1.5 rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-900/60 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                        title={`Quản lý ủy quyền đơn vị ${group.departmentCode}`}
                      >
                        <ShieldCheck size={13} strokeWidth={1.5} />
                        <span>Ủy quyền</span>
                      </Button>
                    </div>
                  )}

                  {onAddTask && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAddTask(group.departmentCode)}
                      className="h-8 px-2.5 text-xs gap-1 rounded-lg"
                    >
                      <Plus size={13} strokeWidth={1.5} />
                      <span className="hidden sm:inline">Giao việc</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Nội dung chi tiết các việc khi mở rộng */}
              {isExpanded && (
                <div
                  id={`dept-panel-${group.departmentId}`}
                  role="region"
                  aria-labelledby={`dept-trigger-${group.departmentId}`}
                  className="border-t border-border/60 bg-background/50 px-4 py-3"
                >
                  {group.allTasks.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Chưa có nhiệm vụ nào được phân công cho đơn vị này.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-border/40 text-muted-foreground font-mono">
                            <th className="py-2 px-2 font-medium">Nhiệm vụ</th>
                            <th className="py-2 px-2 font-medium">Phân cấp</th>
                            <th className="py-2 px-2 font-medium">Người phụ trách</th>
                            <th className="py-2 px-2 font-medium text-right">Hạn chót</th>
                            <th className="py-2 px-2 font-medium text-center">Trạng thái</th>
                            <th className="py-2 px-2 font-medium text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {group.allTasks.map((t) => {
                            const isSchool = "subTasks" in t;
                            const title = t.title;
                            const assignee = isSchool
                              ? t.leadAssigneeName
                              : (t as StaffTask).assigneeName;
                            const dueDate = t.dueDate;
                            const status = t.status;
                            const statusInfo = formatTaskStatus(status, dueDate);

                            return (
                              <tr
                                key={t.id}
                                onClick={() => onSelectTask(t)}
                                className="hover:bg-muted/40 cursor-pointer transition-colors"
                              >
                                <td className="py-2.5 px-2 font-medium text-foreground max-w-[280px] sm:max-w-md truncate">
                                  {title}
                                </td>
                                <td className="py-2.5 px-2">
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-xs font-mono font-medium",
                                      isSchool
                                        ? "bg-primary/10 text-primary border border-primary/20"
                                        : "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    {isSchool ? "Cấp Trường" : "Cấp Đơn vị"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-muted-foreground">
                                  {assignee}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-nums text-muted-foreground">
                                  {dueDate}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded-full text-xs font-medium font-mono whitespace-nowrap",
                                      statusInfo.className
                                    )}
                                  >
                                    {statusInfo.label}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectTask(t);
                                    }}
                                  >
                                    <ArrowUpRight size={13} strokeWidth={1.5} />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
