"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  FileCheck,
  CornerDownRight,
  GitFork,
  BellRing,
  Filter,
} from "lucide-react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type { DeliverableSubmissionPayload, ApprovalActionPayload } from "@/types/workspace";
import type { UniversalActionQueueItems, WorkspaceScope } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ActionQueueButtonMeta {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  variant: "default" | "outline" | "ghost" | "secondary" | "destructive";
  btnClass: string;
}

export function getActionQueueButtonMeta(
  scope: WorkspaceScope,
  itemType: "approval" | "submission"
): ActionQueueButtonMeta {
  if (itemType === "approval") {
    switch (scope) {
      case "school":
        return {
          label: "Phê duyệt",
          icon: CheckCheck,
          variant: "outline",
          btnClass:
            "border-amber-500/30 text-amber-900 bg-amber-500/10 hover:bg-amber-500/20",
        };
      case "unit":
        return {
          label: "Thẩm định L1",
          icon: CheckCircle2,
          variant: "outline",
          btnClass:
            "border-amber-500/30 text-amber-900 bg-amber-500/10 hover:bg-amber-500/20",
        };
      case "my":
      default:
        return {
          label: "Thẩm định",
          icon: FileCheck,
          variant: "outline",
          btnClass:
            "border-amber-500/30 text-amber-900 bg-amber-500/10 hover:bg-amber-500/20",
        };
    }
  }

  return {
    label: "Nộp minh chứng",
    icon: UploadCloud,
    variant: "default",
    btnClass: "bg-blue-600 hover:bg-blue-700 text-white",
  };
}

export interface UniversalActionQueueProps {
  actionQueue: UniversalActionQueueItems;
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  scope?: WorkspaceScope;
  className?: string;
  onReview?: (payload: ApprovalActionPayload) => void;
  onSubmitDeliverable?: (payload: DeliverableSubmissionPayload) => void;
  onOpenReview?: (task: SchoolTask | StaffTask) => void;
  onOpenSubmit?: (task: StaffTask) => void;
  onCreateSubtask?: (parentId: string) => void;
  onRemindDRI?: (taskId: string, targetName: string) => void;
  onFilterCanvas?: (filterType: "approvals" | "submissions" | "overdue" | "all") => void;
}

export function UniversalActionQueue({
  actionQueue,
  onSelectTask,
  scope = "unit",
  className,
  onReview,
  onSubmitDeliverable,
  onOpenReview,
  onOpenSubmit,
  onCreateSubtask,
  onRemindDRI,
  onFilterCanvas,
}: UniversalActionQueueProps) {
  const { pendingApprovals = [], myPendingSubmissions = [] } = actionQueue;
  const [isApprovalsExpanded, setIsApprovalsExpanded] = React.useState(false);
  const [isSubmissionsExpanded, setIsSubmissionsExpanded] = React.useState(false);

  // Calculate overdue items across queue
  const overdueSubmissionsCount = myPendingSubmissions.filter((item: any) => {
    const due = item.dueDate || item.task?.dueDate;
    return item.isOverdue || (due && new Date(due) < new Date());
  }).length;

  const overdueApprovalsCount = pendingApprovals.filter((item: any) => {
    const due = item.task?.dueDate || item.dueDate;
    return due && new Date(due) < new Date();
  }).length;

  const totalOverdue = overdueSubmissionsCount + overdueApprovalsCount;

  // Empty state when there are no urgent items
  if (pendingApprovals.length === 0 && myPendingSubmissions.length === 0) {
    return (
      <div
        data-slot="universal-action-queue"
        className={cn("py-8 text-center text-xs text-slate-400", className)}
      >
        Không có công việc tồn đọng cần xử lý.
      </div>
    );
  }

  const approvalConfig = getActionQueueButtonMeta(scope, "approval");

  const displayedApprovals = isApprovalsExpanded
    ? pendingApprovals
    : pendingApprovals.slice(0, 5);

  const displayedSubmissions = isSubmissionsExpanded
    ? myPendingSubmissions
    : myPendingSubmissions.slice(0, 5);

  return (
    <div
      data-slot="universal-action-queue"
      className={cn("space-y-4", className)}
    >
      {/* Critical deadline warning: subtle inline notice only when overdue > 0 */}
      {totalOverdue > 0 && (
        <div
          role="alert"
          className="flex items-center justify-between text-xs text-rose-600 bg-rose-50/60 rounded px-2.5 py-1.5"
        >
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-3.5 shrink-0 text-rose-500" strokeWidth={1.5} />
            <span>Có <span className="font-semibold tabular-nums">{totalOverdue}</span> tác vụ quá hạn cần ưu tiên xử lý.</span>
          </div>
          {onFilterCanvas && (
            <button
              type="button"
              onClick={() => onFilterCanvas("overdue")}
              className="text-[11px] font-medium text-rose-700 hover:underline cursor-pointer"
            >
              Xem trên bảng
            </button>
          )}
        </div>
      )}

      {/* Approvals Section */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-900">
              {scope === "school"
                ? "Chờ BGH phê duyệt"
                : scope === "unit"
                ? "Cần thẩm định L1"
                : "Cần thẩm định"}{" "}
              <span className="font-mono font-normal text-slate-400 tabular-nums">
                ({pendingApprovals.length})
              </span>
            </span>
            {onFilterCanvas && (
              <button
                type="button"
                onClick={() => onFilterCanvas("approvals")}
                className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Lọc trên bảng
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {displayedApprovals.map((item, idx) => {
              const parentTitle =
                item.parentTaskTitle ||
                (item.task as any).parentTaskTitle ||
                (item.task as any).parentSchoolTaskTitle ||
                (item.task as any).parentTask?.title;
              const parentCode =
                item.parentTaskCode ||
                (item.task as any).parentTaskCode ||
                (item.task as any).parentSchoolTaskCode ||
                (item.task as any).parentTask?.code;
              const parentId =
                item.parentTaskId ||
                (item.task as any).parentTaskId ||
                (item.task as any).parentSchoolTaskId ||
                (item.task as any).parentTask?.id;

              const isItemOverdue = Boolean(
                (item as any).isOverdue ||
                (item.task.dueDate && new Date(item.task.dueDate) < new Date()) ||
                (item.task.status as string) === "AT_RISK"
              );

              return (
                <div
                  key={idx}
                  className="py-2.5 flex items-start justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {parentTitle && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                        <CornerDownRight className="size-2.5 text-slate-400 shrink-0" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTask({
                              id: parentId || "parent",
                              title: parentTitle,
                              taskCode: parentCode,
                            } as SchoolTask);
                          }}
                          className="hover:text-slate-700 truncate text-left cursor-pointer"
                        >
                          {parentCode ? `[${parentCode}] ` : ""}{parentTitle}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectTask(item.task)}
                      className="text-left text-xs font-medium text-slate-900 hover:text-blue-600 truncate block cursor-pointer"
                    >
                      {item.task.title}
                    </button>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate">
                      <span>{item.submittedBy || "Cán bộ chuyên trách"}</span>
                      {item.task.dueDate && (
                        <span className={cn(isItemOverdue ? "text-rose-600 font-medium" : "text-slate-400")}>
                          • Hạn: {item.task.dueDate}
                        </span>
                      )}
                      {item.complianceScore !== undefined && (
                        <span>• DACUM: {item.complianceScore}%</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    {isItemOverdue && onRemindDRI && (
                      <button
                        type="button"
                        onClick={() =>
                          onRemindDRI(
                            item.task.id,
                            item.submittedBy || (item.task as any).assignedTo || ""
                          )
                        }
                        className="h-6 px-2 text-[11px] font-medium rounded text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                        title="Đôn đốc tiến độ thực hiện nhiệm vụ"
                      >
                        Đôn đốc
                      </button>
                    )}

                    {scope === "unit" && onCreateSubtask && (
                      <button
                        type="button"
                        onClick={() => onCreateSubtask(item.task.id)}
                        className="h-6 px-2 text-[11px] font-medium rounded text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                        title="Phân rã nhiệm vụ cho chuyên viên"
                      >
                        Phân công
                      </button>
                    )}

                    <button
                      type="button"
                      className="h-6 px-2.5 text-xs font-medium rounded text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                      onClick={() => {
                        if (onOpenReview) {
                          onOpenReview(item.task);
                        } else {
                          onSelectTask(item.task);
                        }
                      }}
                    >
                      {approvalConfig.label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {pendingApprovals.length > 5 && (
            <button
              type="button"
              className="w-full py-1.5 text-[11px] text-slate-500 hover:text-slate-800 text-center cursor-pointer"
              onClick={() => setIsApprovalsExpanded(!isApprovalsExpanded)}
            >
              {isApprovalsExpanded
                ? "Thu gọn"
                : `Xem thêm (${pendingApprovals.length - 5})`}
            </button>
          )}
        </div>
      )}

      {/* Submissions Section */}
      {myPendingSubmissions.length > 0 && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-900">
              Cần nộp minh chứng{" "}
              <span className="font-mono font-normal text-slate-400 tabular-nums">
                ({myPendingSubmissions.length})
              </span>
            </span>
            {onFilterCanvas && (
              <button
                type="button"
                onClick={() => onFilterCanvas("submissions")}
                className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Lọc trên bảng
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {displayedSubmissions.map((item, idx) => {
              const parentTitle =
                item.parentTaskTitle ||
                (item.task as any).parentTaskTitle ||
                (item.task as any).parentSchoolTaskTitle ||
                (item.task as any).parentTask?.title;
              const parentCode =
                item.parentTaskCode ||
                (item.task as any).parentTaskCode ||
                (item.task as any).parentSchoolTaskCode ||
                (item.task as any).parentTask?.code;
              const parentId =
                item.parentTaskId ||
                (item.task as any).parentTaskId ||
                (item.task as any).parentSchoolTaskId ||
                (item.task as any).parentTask?.id;

              return (
                <div
                  key={idx}
                  className="py-2.5 flex items-start justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {parentTitle && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                        <CornerDownRight className="size-2.5 text-slate-400 shrink-0" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTask({
                              id: parentId || "parent",
                              title: parentTitle,
                              taskCode: parentCode,
                            } as SchoolTask);
                          }}
                          className="hover:text-slate-700 truncate text-left cursor-pointer"
                        >
                          {parentCode ? `[${parentCode}] ` : ""}{parentTitle}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectTask(item.task)}
                      className="text-left text-xs font-medium text-slate-900 hover:text-blue-600 truncate block cursor-pointer"
                    >
                      {item.task.title}
                    </button>
                    <div className="text-[11px] text-slate-400 truncate">
                      {item.isOverdue ? (
                        <span className="text-rose-600 font-medium">
                          Quá hạn: {item.dueDate}
                        </span>
                      ) : (
                        <span>Hạn: {item.dueDate || "Trong tuần"}</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    <button
                      type="button"
                      className="h-6 px-2.5 text-xs font-medium rounded text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                      onClick={() => {
                        if (onOpenSubmit) {
                          const staffTask: StaffTask = ("assigneeName" in item.task)
                            ? (item.task as StaffTask)
                            : {
                                id: item.task.id,
                                title: item.task.title,
                                assigneeName: (item.task as any).assignee || (item.task as any).assignedTo || "",
                                department: (item.task as any).assignedDepartment || "",
                                status: item.task.status as any,
                                dueDate: item.task.dueDate || "",
                                parentSchoolTaskId: item.task.id,
                                updatedAt: new Date().toISOString(),
                                deliverables: (item.task as any).deliverables || [],
                              };
                          onOpenSubmit(staffTask);
                        } else if (onSubmitDeliverable) {
                          onSubmitDeliverable({
                            taskId: item.task.id,
                            deliverableName: item.task.title,
                          });
                        } else {
                          onSelectTask(item.task);
                        }
                      }}
                    >
                      Nộp minh chứng
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {myPendingSubmissions.length > 5 && (
            <button
              type="button"
              className="w-full py-1.5 text-[11px] text-slate-500 hover:text-slate-800 text-center cursor-pointer"
              onClick={() => setIsSubmissionsExpanded(!isSubmissionsExpanded)}
            >
              {isSubmissionsExpanded
                ? "Thu gọn"
                : `Xem thêm (${myPendingSubmissions.length - 5})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
