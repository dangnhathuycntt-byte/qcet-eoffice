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
  Send,
  FileCheck,
} from "lucide-react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type { DeliverableSubmissionPayload, ApprovalActionPayload } from "@/types/workspace";
import type { UniversalActionQueueItems, WorkspaceScope } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface UniversalActionQueueProps {
  actionQueue: UniversalActionQueueItems;
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  scope?: WorkspaceScope;
  className?: string;
  onReview?: (payload: ApprovalActionPayload) => void;
  onSubmitDeliverable?: (payload: DeliverableSubmissionPayload) => void;
  onOpenReview?: (task: SchoolTask | StaffTask) => void;
  onOpenSubmit?: (task: StaffTask) => void;
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
}: UniversalActionQueueProps) {
  const { pendingApprovals = [], myPendingSubmissions = [] } = actionQueue;
  const [isApprovalsExpanded, setIsApprovalsExpanded] = React.useState(false);
  const [isSubmissionsExpanded, setIsSubmissionsExpanded] = React.useState(false);

  // Calculate overdue items across queue
  const overdueSubmissionsCount = myPendingSubmissions.filter(
    (item) => item.isOverdue || (item.dueDate && new Date(item.dueDate) < new Date())
  ).length;

  const overdueApprovalsCount = pendingApprovals.filter(
    (item) => item.task.dueDate && new Date(item.task.dueDate) < new Date()
  ).length;

  const totalOverdue = overdueSubmissionsCount + overdueApprovalsCount;

  // Empty state when there are no urgent items
  if (pendingApprovals.length === 0 && myPendingSubmissions.length === 0) {
    return (
      <div
        data-slot="universal-action-queue"
        className={cn(
          "rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center justify-between gap-3 shadow-2xs transition-all",
          className
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-8 rounded-full bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-4" strokeWidth={2} />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground">
              Không có nhiệm vụ cần xử lý gấp
            </h4>
            <p className="text-xs text-muted-foreground truncate">
              Tất cả công việc đều đúng tiến độ và không có hồ sơ tồn đọng cần phê duyệt.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Determine action button label and icon for pending approvals lane
  const getApprovalActionConfig = () => {
    switch (scope) {
      case "school":
        return {
          label: "Phê duyệt",
          icon: CheckCheck,
          variant: "outline" as const,
          btnClass:
            "border-amber-500/30 text-amber-900 bg-amber-500/10 hover:bg-amber-500/20",
        };
      case "unit":
        return {
          label: "Phân công",
          icon: Send,
          variant: "outline" as const,
          btnClass:
            "border-amber-500/30 text-amber-900 bg-amber-500/10 hover:bg-amber-500/20",
        };
      case "my":
      default:
        return {
          label: "Thẩm định",
          icon: FileCheck,
          variant: "outline" as const,
          btnClass:
            "border-amber-500/30 text-amber-900 bg-amber-500/10 hover:bg-amber-500/20",
        };
    }
  };

  const approvalConfig = getApprovalActionConfig();

  const displayedApprovals = isApprovalsExpanded
    ? pendingApprovals
    : pendingApprovals.slice(0, 3);

  const displayedSubmissions = isSubmissionsExpanded
    ? myPendingSubmissions
    : myPendingSubmissions.slice(0, 3);

  return (
    <div
      data-slot="universal-action-queue"
      className={cn("space-y-3", className)}
    >
      {/* Critical deadline warning banner when overdue > 0 */}
      {totalOverdue > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-3 flex items-center justify-between text-rose-900 gap-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-rose-500/10 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="size-4" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-xs font-bold tracking-tight text-rose-950">
                Cảnh báo hạn chót khẩn cấp
              </div>
              <div className="text-xs text-rose-800">
                Có{" "}
                <span className="font-mono font-semibold tabular-nums">
                  {totalOverdue}
                </span>{" "}
                tác vụ quá hạn cần ưu tiên xử lý ngay.
              </div>
            </div>
          </div>
          <span className="text-xs font-mono font-bold tabular-nums text-rose-800 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 shrink-0">
            {totalOverdue} QUÁ HẠN
          </span>
        </div>
      )}

      {/* Triage strip grid: auto-fits to full width when only 1 lane has items */}
      <div
        className={cn(
          "grid gap-3.5",
          pendingApprovals.length > 0 && myPendingSubmissions.length > 0
            ? "grid-cols-1 lg:grid-cols-2"
            : "grid-cols-1"
        )}
      >
        {/* Lane 1: Incoming Approvals */}
        {pendingApprovals.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.03] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-xs font-bold text-amber-900 tracking-tight">
                  Hàng đợi thẩm định (
                  <span className="font-mono tabular-nums">
                    {pendingApprovals.length}
                  </span>
                  )
                </h3>
              </div>
              <span className="text-xs font-medium text-amber-800">
                {scope === "school" ? "Chờ BGH phê duyệt" : "Cần lãnh đạo xử lý"}
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {displayedApprovals.map((item, idx) => {
                const ActionIcon = approvalConfig.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-amber-500/20 hover:border-amber-500/40 transition-all shadow-2xs group gap-2"
                  >
                    <div className="min-w-0 flex-1 pr-1">
                      <button
                        type="button"
                        onClick={() => onSelectTask(item.task)}
                        className="text-left text-xs font-semibold text-foreground hover:text-amber-900 focus-visible:underline focus-visible:outline-none transition-colors truncate block w-full cursor-pointer"
                      >
                        {item.task.title}
                      </button>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                        <span>
                          Người nộp: {item.submittedBy || "Cán bộ chuyên trách"}
                        </span>
                        {item.complianceScore !== undefined && (
                          <span className="font-mono tabular-nums text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs font-semibold border border-emerald-500/20 shrink-0">
                            DACUM: {item.complianceScore}%
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="xs"
                      variant={approvalConfig.variant}
                      className={cn(
                        "min-h-[44px] touch-manipulation px-3.5 rounded-lg text-xs font-semibold shrink-0 gap-1.5 cursor-pointer",
                        approvalConfig.btnClass
                      )}
                      onClick={() => {
                        // Mở modal/sheet thẩm định chi tiết có danh tính thật nếu có, hoặc chuyển sang chọn task
                        if (onOpenReview) {
                          onOpenReview(item.task);
                        } else {
                          onSelectTask(item.task);
                        }
                      }}
                    >
                      <ActionIcon className="size-3" strokeWidth={1.75} />
                      <span>{approvalConfig.label}</span>
                      <ChevronRight className="size-3 ml-0.5 opacity-70" strokeWidth={1.5} />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Collapsible tray button when count > 3 */}
            {pendingApprovals.length > 3 && (
              <Button
                variant="ghost"
                size="xs"
                aria-expanded={isApprovalsExpanded}
                className="w-full text-xs font-semibold text-amber-800 hover:bg-amber-500/10 justify-center h-8 min-h-[32px] cursor-pointer"
                onClick={() => setIsApprovalsExpanded(!isApprovalsExpanded)}
              >
                {isApprovalsExpanded ? (
                  <>
                    <span>Thu gọn</span>
                    <ChevronUp className="size-3.5 ml-1" />
                  </>
                ) : (
                  <>
                    <span>
                      Xem thêm (
                      <span className="font-mono tabular-nums">
                        {pendingApprovals.length - 3}
                      </span>
                      )
                    </span>
                    <ChevronDown className="size-3.5 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Lane 2: My Pending Submissions */}
        {myPendingSubmissions.length > 0 && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.03] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                <h3 className="text-xs font-bold text-blue-900 tracking-tight">
                  Nhiệm vụ cần nộp hồ sơ minh chứng (
                  <span className="font-mono tabular-nums">
                    {myPendingSubmissions.length}
                  </span>
                  )
                </h3>
              </div>
              <span className="text-xs font-medium text-blue-800">
                Hạn nộp báo cáo
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {displayedSubmissions.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-blue-500/20 hover:border-blue-500/40 transition-all shadow-2xs group gap-2"
                >
                  <div className="min-w-0 flex-1 pr-1">
                    <button
                      type="button"
                      onClick={() => onSelectTask(item.task)}
                      className="text-left text-xs font-semibold text-foreground hover:text-blue-900 focus-visible:underline focus-visible:outline-none transition-colors truncate block w-full cursor-pointer"
                    >
                      {item.task.title}
                    </button>
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                      {item.isOverdue ? (
                        <span className="text-rose-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="size-3" strokeWidth={1.5} />
                          Quá hạn:{" "}
                          <span className="font-mono tabular-nums">
                            {item.dueDate}
                          </span>
                        </span>
                      ) : (
                        <span>
                          Hạn:{" "}
                          <span className="font-mono tabular-nums">
                            {item.dueDate || "Trong tuần"}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="xs"
                    className="min-h-[44px] touch-manipulation px-3.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shrink-0 gap-1.5 cursor-pointer"
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
                    <UploadCloud className="size-3" strokeWidth={1.75} />
                    <span>Nộp minh chứng</span>
                  </Button>
                </div>
              ))}
            </div>

            {/* Collapsible tray button when count > 3 */}
            {myPendingSubmissions.length > 3 && (
              <Button
                variant="ghost"
                size="xs"
                aria-expanded={isSubmissionsExpanded}
                className="w-full text-xs font-semibold text-blue-800 hover:bg-blue-500/10 justify-center h-8 min-h-[32px] cursor-pointer"
                onClick={() => setIsSubmissionsExpanded(!isSubmissionsExpanded)}
              >
                {isSubmissionsExpanded ? (
                  <>
                    <span>Thu gọn</span>
                    <ChevronUp className="size-3.5 ml-1" />
                  </>
                ) : (
                  <>
                    <span>
                      Xem thêm (
                      <span className="font-mono tabular-nums">
                        {myPendingSubmissions.length - 3}
                      </span>
                      )
                    </span>
                    <ChevronDown className="size-3.5 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
