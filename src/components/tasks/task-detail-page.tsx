"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Briefcase,
  Calendar,
  Clock,
  CheckCircle2,
  FileCheck,
  Play,
  RotateCcw,
  AlertTriangle,
  Plus,
  FileText,
  Paperclip,
  Download,
  ExternalLink,
  History,
  TrendingUp,
  User,
  Users,
  Check,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import { useAuth } from "@/lib/auth-context";
import { useListScrollRestore } from "@/hooks/use-list-scroll-restore";
import { formatDetailDate, getDetailStatusConfig, getRelativeDueTime } from "@/components/dashboard/task-detail-side-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CreateTaskModal } from "@/components/dashboard/create-task-modal";

export interface TaskDetailPageProps {
  task: SchoolTask | StaffTask;
  auditEvents?: Array<{
    id: string;
    action: string;
    timestamp: string;
    actorName?: string;
    description?: string;
  }>;
}

export function TaskDetailPage({
  task: initialTask,
  auditEvents: initialAuditEvents = [],
}: TaskDetailPageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { restoreScrollAndNavigateBack } = useListScrollRestore();

  const [task, setTask] = React.useState<SchoolTask | StaffTask>(initialTask);
  const [auditEvents, setAuditEvents] = React.useState(initialAuditEvents);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [statusFeedback, setStatusFeedback] = React.useState<string | null>(null);

  // Subtask modal state
  const [isCreateSubTaskModalOpen, setIsCreateSubTaskModalOpen] = React.useState(false);

  // Deliverable inline submission state
  const [deliverableName, setDeliverableName] = React.useState("");
  const [deliverableUrl, setDeliverableUrl] = React.useState("");
  const [deliverableNotes, setDeliverableNotes] = React.useState("");
  const [isSubmittingDeliverable, setIsSubmittingDeliverable] = React.useState(false);
  const [deliverableSuccess, setDeliverableSuccess] = React.useState<string | null>(null);
  const [deliverableError, setDeliverableError] = React.useState<string | null>(null);

  // Rejection/Revision modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectError, setRejectError] = React.useState<string | null>(null);

  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  // Code & Labels
  const taskCode =
    task.code ||
    (isSchool ? schoolTask?.taskCode : staffTask?.taskId) ||
    task.id.slice(0, 8).toUpperCase();

  const statusConfig = getDetailStatusConfig(task.status);
  const relativeTime = getRelativeDueTime(task.dueDate);

  // Role permissions
  const userRole = user?.role || "STAFF";
  const isExecutive = ["ADMIN", "BGH", "BAN_GIAM_HIEU", "HIEU_TRUONG", "PHO_HIEU_TRUONG"].includes(
    String(userRole).toUpperCase()
  );
  const isManager = ["MANAGER", "TRUONG_PHONG", "TRUONG_DON_VI"].includes(
    String(userRole).toUpperCase()
  );

  const leadAssigneeName = isSchool
    ? schoolTask?.leadAssigneeName || "Chưa phân công"
    : staffTask?.assigneeName || "Chưa phân công";

  const leadDepartmentName = isSchool
    ? schoolTask?.departmentName || schoolTask?.department || schoolTask?.leadDepartment || "QCET"
    : staffTask?.assignedToDepartmentName || staffTask?.department || "QCET";

  const currentUserId = user?.id;
  const assigneeId = isSchool ? schoolTask?.leadAssigneeId : staffTask?.assigneeId;
  const isAssignee = !!(currentUserId && assigneeId && currentUserId === assigneeId);

  // Progress resolution
  const progressPercent =
    typeof (task as any).progressPercent === "number"
      ? (task as any).progressPercent
      : isSchool
      ? schoolTask?.progress ?? 0
      : 0;

  // Subtask resolution
  const subTasks = isSchool && Array.isArray(schoolTask?.subTasks) ? schoolTask.subTasks : [];
  const totalSubTasks = isSchool ? schoolTask?.totalSubTasks ?? subTasks.length : 0;
  const completedSubTasks = isSchool
    ? schoolTask?.completedSubTasks ?? subTasks.filter((s) => s.status === "COMPLETED").length
    : 0;

  // Deliverables list
  const deliverables = (task as any).deliverables || [];

  const taskDescription = isSchool
    ? schoolTask?.description
    : staffTask?.deliverableDescription || (task as any).description;

  // Update status handler
  const handleStatusChange = async (newStatus: TaskStatus, reason?: string) => {
    setIsUpdatingStatus(true);
    setStatusFeedback(null);
    try {
      const payload: Record<string, any> = { status: newStatus };
      if (reason) payload.rejectionReason = reason;

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Cập nhật trạng thái không thành công");
      }

      setTask((prev) => ({
        ...prev,
        status: newStatus,
        ...(newStatus === "COMPLETED" ? { progressPercent: 100 } : {}),
      }));

      // Add local audit entry
      setAuditEvents((prev) => [
        {
          id: `audit-${Date.now()}`,
          action: newStatus,
          timestamp: new Date().toISOString(),
          actorName: user?.name || "Người dùng hiện tại",
          description: `Chuyển trạng thái sang: ${getDetailStatusConfig(newStatus).label}`,
        },
        ...prev,
      ]);

      setStatusFeedback(`Đã cập nhật trạng thái: ${getDetailStatusConfig(newStatus).label}`);
      setTimeout(() => setStatusFeedback(null), 3500);
    } catch (err: any) {
      setStatusFeedback(`Lỗi: ${err.message || "Không thể cập nhật trạng thái"}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Submit deliverable handler
  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverableUrl.trim() && !deliverableNotes.trim() && !deliverableName.trim()) {
      setDeliverableError("Vui lòng nhập tên tài liệu hoặc liên kết/mô tả sản phẩm.");
      return;
    }

    setIsSubmittingDeliverable(true);
    setDeliverableError(null);
    setDeliverableSuccess(null);

    try {
      const res = await fetch(`/api/tasks/${task.id}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: deliverableName.trim() || "Minh chứng kết quả nhiệm vụ",
          fileUrl: deliverableUrl.trim() || undefined,
          notes: deliverableNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        // Fallback simulation if direct deliverables sub-endpoint returns 404/not supported
        const fallbackRes = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "NEEDS_REVIEW",
            deliverableDescription: `${deliverableName}: ${deliverableUrl} - ${deliverableNotes}`,
          }),
        });
        if (!fallbackRes.ok) {
          throw new Error("Không thể nộp sản phẩm minh chứng");
        }
      }

      setDeliverableSuccess("Đã nộp minh chứng nghiệm thu thành công.");
      setDeliverableName("");
      setDeliverableUrl("");
      setDeliverableNotes("");
      setTask((prev) => ({
        ...prev,
        status: "NEEDS_REVIEW",
      }));
    } catch (err: any) {
      setDeliverableError(err.message || "Lỗi khi nộp minh chứng.");
    } finally {
      setIsSubmittingDeliverable(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top bar: Back to list + Task Code */}
        <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => restoreScrollAndNavigateBack("/tasks")}
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            <span>← Danh sách nhiệm vụ</span>
          </Button>

          <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-muted/80 border border-border/70 text-foreground tabular-nums">
            {taskCode}
          </span>
        </div>

        {/* Title Header & Primary Actions */}
        <div className="bg-card border border-border/60 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              {/* Level Badge */}
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 text-xs font-semibold px-2.5 py-0.5",
                  isSchool
                    ? "border-purple-500/30 bg-purple-500/10 text-purple-700"
                    : "border-blue-500/30 bg-blue-500/10 text-blue-700"
                )}
              >
                {isSchool ? <Building2 className="size-3.5" /> : <Briefcase className="size-3.5" />}
                <span>{isSchool ? "Cấp Trường" : "Cấp Đơn vị"}</span>
              </Badge>

              {/* Status Badge */}
              <Badge
                variant={statusConfig.variant}
                className={cn("text-xs font-medium px-2.5 py-0.5", statusConfig.className)}
              >
                {statusConfig.label}
              </Badge>

              {/* Due Relative Pill */}
              {relativeTime && (
                <span
                  className={cn(
                    "text-xs px-2.5 py-0.5 rounded-full border font-mono tabular-nums",
                    relativeTime.color
                  )}
                >
                  {relativeTime.text}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading leading-snug">
              {task.title}
            </h1>
          </div>

          {/* Primary Action Buttons according to Role */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* NEW: Accept task */}
            {task.status === "NEW" && (isAssignee || isManager || isExecutive) && (
              <Button
                type="button"
                size="sm"
                disabled={isUpdatingStatus}
                onClick={() => handleStatusChange("IN_PROGRESS")}
                className="h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg gap-1.5 shadow-xs"
              >
                <Play className="size-3.5" strokeWidth={2} />
                <span>Tiếp nhận</span>
              </Button>
            )}

            {/* IN_PROGRESS: Complete or Submit */}
            {task.status === "IN_PROGRESS" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isUpdatingStatus}
                  onClick={() => {
                    const form = document.getElementById("deliverable-submission-form");
                    form?.scrollIntoView({ behavior: "smooth" });
                    document.getElementById("deliverable-name")?.focus();
                  }}
                  className="h-9 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 rounded-lg gap-1.5"
                >
                  <FileCheck className="size-3.5" strokeWidth={1.5} />
                  <span>Nộp minh chứng</span>
                </Button>

                {(isAssignee || isManager || isExecutive) && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isUpdatingStatus}
                    onClick={() => handleStatusChange("COMPLETED")}
                    className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="size-3.5" strokeWidth={2} />
                    <span>Hoàn thành</span>
                  </Button>
                )}
              </>
            )}

            {/* NEEDS_REVIEW / WAITING_APPROVAL: Approve or Request Changes */}
            {(task.status === "NEEDS_REVIEW" || task.status === "WAITING_APPROVAL") && (
              <>
                {(isManager || isExecutive) && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isUpdatingStatus}
                    onClick={() => handleStatusChange("COMPLETED")}
                    className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5 shadow-xs"
                  >
                    <Check className="size-3.5" strokeWidth={2} />
                    <span>Phê duyệt</span>
                  </Button>
                )}

                {(isManager || isExecutive) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isUpdatingStatus}
                    onClick={() => setIsRejectModalOpen(true)}
                    className="h-9 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300 rounded-lg gap-1.5"
                  >
                    <RotateCcw className="size-3.5" strokeWidth={1.5} />
                    <span>Yêu cầu chỉnh sửa</span>
                  </Button>
                )}
              </>
            )}

            {/* COMPLETED: Reopen option for Managers/Executive */}
            {task.status === "COMPLETED" && (isManager || isExecutive) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isUpdatingStatus}
                onClick={() => handleStatusChange("IN_PROGRESS")}
                className="h-9 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg gap-1.5"
              >
                <RotateCcw className="size-3.5" strokeWidth={1.5} />
                <span>Mở lại nhiệm vụ</span>
              </Button>
            )}
          </div>
        </div>

        {statusFeedback && (
          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-50 text-emerald-800 text-xs font-medium">
            {statusFeedback}
          </div>
        )}

        {/* 2-Column Main Layout (2/3 Main + 1/3 Sidebar) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Mô tả & Yêu cầu */}
            <section className="bg-card border border-border/60 rounded-xl p-5 shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="size-4 text-primary" strokeWidth={1.5} />
                <span>Mô tả & Yêu cầu nhiệm vụ</span>
              </h2>

              {taskDescription || (schoolTask && schoolTask.executiveCriteria) ? (
                <div className="space-y-3 text-xs leading-relaxed text-foreground/90">
                  {taskDescription && (
                    <div className="p-3.5 rounded-lg bg-muted/30 border border-border/40 whitespace-pre-wrap">
                      {taskDescription}
                    </div>
                  )}

                  {schoolTask?.executiveCriteria && (
                    <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-200/60 text-blue-900 space-y-1">
                      <span className="font-semibold text-xs block text-blue-800">
                        Tiêu chí trọng tâm từ Ban Giám hiệu:
                      </span>
                      <p className="whitespace-pre-wrap">{schoolTask.executiveCriteria}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-1">
                  Chưa có mô tả yêu cầu
                </p>
              )}
            </section>

            {/* 2. Sản phẩm minh chứng / Tệp đính kèm */}
            <section className="bg-card border border-border/60 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Paperclip className="size-4 text-primary" strokeWidth={1.5} />
                  <span>Sản phẩm minh chứng / Tệp đính kèm</span>
                </h2>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {deliverables.length} tệp
                </span>
              </div>

              {deliverables.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-1">
                  Chưa có sản phẩm minh chứng hoặc tệp đính kèm
                </p>
              ) : (
                <div className="divide-y divide-border/40 rounded-lg border border-border/50 overflow-hidden text-xs">
                  {deliverables.map((item: any) => (
                    <div
                      key={item.id || item.title || item.name}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="size-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {item.title || item.name}
                          </p>
                          {item.fileUrl && (
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline font-mono truncate block"
                            >
                              {item.fileUrl}
                            </a>
                          )}
                        </div>
                      </div>

                      {item.fileUrl && (
                        <a
                          href={item.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border/60 bg-muted/40 hover:bg-muted text-foreground text-xs font-medium shrink-0"
                        >
                          <ExternalLink className="size-3" />
                          <span>Mở</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Form nộp minh chứng */}
              <div id="deliverable-submission-form" className="pt-3 border-t border-border/40">
                <form onSubmit={handleSubmitDeliverable} className="space-y-3">
                  <span className="text-xs font-semibold text-foreground block">
                    Nộp thêm minh chứng / liên kết kết quả:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label htmlFor="deliverable-name" className="block text-muted-foreground mb-1">
                        Tên sản phẩm
                      </label>
                      <input
                        id="deliverable-name"
                        type="text"
                        value={deliverableName}
                        onChange={(e) => setDeliverableName(e.target.value)}
                        placeholder="Ví dụ: Báo cáo kết quả tuần 1..."
                        className="w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="deliverable-url" className="block text-muted-foreground mb-1">
                        Đường dẫn (Drive, Cloud, Tệp)
                      </label>
                      <input
                        id="deliverable-url"
                        type="url"
                        value={deliverableUrl}
                        onChange={(e) => setDeliverableUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="deliverable-notes" className="block text-xs text-muted-foreground mb-1">
                      Ghi chú tóm tắt
                    </label>
                    <textarea
                      id="deliverable-notes"
                      rows={2}
                      value={deliverableNotes}
                      onChange={(e) => setDeliverableNotes(e.target.value)}
                      placeholder="Mô tả tóm tắt kết quả đã thực hiện..."
                      className="w-full rounded-md border border-border/60 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>

                  {deliverableError && (
                    <p className="text-xs font-medium text-rose-600">{deliverableError}</p>
                  )}
                  {deliverableSuccess && (
                    <p className="text-xs font-medium text-emerald-600">{deliverableSuccess}</p>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmittingDeliverable}
                      className="h-8 text-xs font-semibold bg-primary text-primary-foreground rounded-lg gap-1.5"
                    >
                      <FileCheck className="size-3.5" />
                      <span>{isSubmittingDeliverable ? "Đang gửi..." : "Gửi minh chứng"}</span>
                    </Button>
                  </div>
                </form>
              </div>
            </section>

            {/* 3. Danh sách nhiệm vụ con (CHỈ DUY NHẤT 1 NÚT '+ Thêm việc con') */}
            <section className="bg-card border border-border/60 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">Nhiệm vụ con</h2>
                  <Badge variant="outline" className="text-xs font-mono">
                    {subTasks.length} việc
                  </Badge>
                </div>

                {/* Single consolidated add button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateSubTaskModalOpen(true)}
                  className="h-7.5 text-xs gap-1 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-semibold rounded-lg"
                >
                  <Plus className="size-3.5" strokeWidth={2} />
                  <span>+ Thêm việc con</span>
                </Button>
              </div>

              {subTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-1">
                  Chưa có nhiệm vụ con trực thuộc
                </p>
              ) : (
                <div className="divide-y divide-border/40 rounded-lg border border-border/50 overflow-hidden text-xs">
                  {subTasks.map((sub) => {
                    const subStatus = getDetailStatusConfig(sub.status);
                    return (
                      <div
                        key={sub.id}
                        onClick={() => router.push(`/tasks/${sub.id}`)}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold text-foreground hover:text-primary transition-colors truncate">
                            {sub.title}
                          </p>
                          <div className="flex items-center gap-3 text-muted-foreground text-xs">
                            <span className="flex items-center gap-1">
                              <User className="size-3" />
                              {sub.assigneeName || "Chưa gán"}
                            </span>
                            <span className="flex items-center gap-1 font-mono tabular-nums">
                              <Calendar className="size-3" />
                              {sub.dueDate ? formatDetailDate(sub.dueDate) : "Không hạn"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {typeof sub.progressPercent === "number" && (
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted/60 border border-border/50 font-semibold tabular-nums">
                              {sub.progressPercent}%
                            </span>
                          )}

                          <Badge
                            variant={subStatus.variant}
                            className={cn("text-xs px-2 py-0.5 font-medium", subStatus.className)}
                          >
                            {subStatus.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 4. Trao đổi & Lịch sử xử lý */}
            <section className="bg-card border border-border/60 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <History className="size-4 text-primary" strokeWidth={1.5} />
                  <span>Trao đổi & Lịch sử xử lý</span>
                </h2>
                {auditEvents.length > 0 && (
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {auditEvents.length} mốc
                  </span>
                )}
              </div>

              {auditEvents.length > 0 ? (
                <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/60">
                  {auditEvents.map((evt) => (
                    <div key={evt.id} className="relative flex flex-col gap-0.5 text-xs">
                      <span className="absolute -left-5 top-1 flex size-4 items-center justify-center rounded-full border border-border/80 bg-card">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">
                          {evt.description || evt.action}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {formatDetailDate(evt.timestamp)}
                        </span>
                      </div>
                      {evt.actorName && (
                        <span className="text-muted-foreground">Người thao tác: {evt.actorName}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground rounded-lg border border-dashed border-border/60 bg-muted/20">
                  Chưa có lịch sử xử lý nào được ghi nhận cho nhiệm vụ này.
                </div>
              )}
            </section>
          </div>

          {/* Sidebar Column (1/3): Card thông tin điều hành */}
          <div className="space-y-6">
            <div className="bg-card border border-border/60 rounded-xl p-5 shadow-xs space-y-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
                Thông tin điều hành
              </h2>

              <div className="space-y-4 text-xs">
                {/* Người chủ trì */}
                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" />
                    Chủ trì nhiệm vụ
                  </span>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary border border-primary/20">
                      {leadAssigneeName.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-semibold text-foreground">{leadAssigneeName}</span>
                  </div>
                </div>

                {/* Đơn vị chủ trì */}
                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    Đơn vị chủ trì
                  </span>
                  <p className="font-semibold text-foreground">{leadDepartmentName}</p>
                </div>

                {/* Người giao nhiệm vụ */}
                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Users className="size-3.5 text-muted-foreground" />
                    Người giao nhiệm vụ
                  </span>
                  <p className="font-semibold text-foreground">
                    {isSchool ? "Ban Giám hiệu QCET" : "Trưởng đơn vị"}
                  </p>
                </div>

                {/* Hạn xử lý & SLA */}
                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" />
                    Thời hạn hoàn thành
                  </span>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {formatDetailDate(task.dueDate)}
                    </span>
                    {relativeTime && (
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-mono font-medium border",
                          relativeTime.color
                        )}
                      >
                        {relativeTime.text}
                      </span>
                    )}
                  </div>
                </div>

                {/* FIX TRIỆT ĐỂ: Tách riêng Tiến độ thực tế và Nhiệm vụ con */}
                <div className="pt-3 border-t border-border/40 space-y-3">
                  {/* Tiến độ thực tế */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                        <TrendingUp className="size-3.5 text-muted-foreground" />
                        Tiến độ thực tế
                      </span>
                      <span className="font-mono font-bold text-foreground tabular-nums">
                        {progressPercent}%
                      </span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/80">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Nhiệm vụ con */}
                  {isSchool && (
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-muted-foreground font-medium">Nhiệm vụ con:</span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {completedSubTasks}/{totalSubTasks} hoàn thành
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Rejection / Revision */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border/60 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <RotateCcw className="size-4 text-amber-600" />
                <span>Yêu cầu chỉnh sửa minh chứng</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label htmlFor="reject-reason" className="block font-medium text-muted-foreground">
                Lý do yêu cầu sửa / nhận xét
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nêu rõ các nội dung cần bổ sung hoặc sửa đổi..."
                className="w-full rounded-md border border-border/60 bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              />
              {rejectError && <p className="text-rose-600 font-medium">{rejectError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRejectModalOpen(false)}
                className="h-8 text-xs"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isUpdatingStatus}
                onClick={async () => {
                  if (!rejectReason.trim()) {
                    setRejectError("Vui lòng nhập lý do chỉnh sửa");
                    return;
                  }
                  await handleStatusChange("IN_PROGRESS", rejectReason.trim());
                  setIsRejectModalOpen(false);
                }}
                className="h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
              >
                Gửi yêu cầu sửa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add SubTask */}
      <CreateTaskModal
        isOpen={isCreateSubTaskModalOpen}
        onClose={() => setIsCreateSubTaskModalOpen(false)}
        initialParentTaskId={task.id}
        initialParentTaskTitle={task.title}
        initialLevel="DON_VI"
        onSubmitSuccess={() => {
          setIsCreateSubTaskModalOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
