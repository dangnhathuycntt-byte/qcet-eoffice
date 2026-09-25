"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  ClipboardCheck,
  FileCheck,
  PenLine,
  Hash,
  Stamp,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import type { OutgoingDocumentStatus } from "@/contracts/documents";

interface ActionDef {
  label: string;
  description: string;
  action: string;
  variant: "primary" | "danger" | "secondary";
  icon: React.ElementType;
  requiresNote?: boolean;
}

const STATUS_ACTIONS: Partial<Record<OutgoingDocumentStatus, ActionDef[]>> = {
  DRAFT: [
    {
      label: "Trình phê duyệt nội dung",
      description: "Gửi dự thảo lên Trưởng đơn vị để phê duyệt nội dung",
      action: "submit-content-review",
      variant: "primary",
      icon: ClipboardCheck,
    },
  ],
  CONTENT_REVIEW: [
    {
      label: "Phê duyệt nội dung",
      description: "Xác nhận nội dung văn bản đạt yêu cầu",
      action: "approve-content",
      variant: "primary",
      icon: CheckCircle2,
    },
    {
      label: "Yêu cầu chỉnh sửa",
      description: "Trả lại dự thảo để chỉnh sửa nội dung",
      action: "revision",
      variant: "danger",
      icon: RotateCcw,
      requiresNote: true,
    },
  ],
  FORMAT_CHECK: [
    {
      label: "Xác nhận thể thức đạt",
      description: "Kiểm tra thể thức, kỹ thuật trình bày theo NĐ 30/2020",
      action: "approve-format",
      variant: "primary",
      icon: FileCheck,
    },
    {
      label: "Yêu cầu chỉnh sửa",
      description: "Trả lại để bổ sung, chỉnh sửa thể thức",
      action: "revision",
      variant: "danger",
      icon: RotateCcw,
      requiresNote: true,
    },
  ],
  AUTHORIZED_SIGN: [
    {
      label: "Ký chức danh",
      description: "Ký số xác nhận thẩm quyền ban hành",
      action: "sign",
      variant: "primary",
      icon: PenLine,
    },
  ],
  NUMBERED: [
    {
      label: "Cấp số & ngày ban hành",
      description: "Cấp số văn bản đi liên tục và xác nhận ngày ban hành",
      action: "assign-number",
      variant: "primary",
      icon: Hash,
    },
  ],
  ORGANIZATION_SIGNED: [
    {
      label: "Đóng dấu cơ quan",
      description: "Ký số tổ chức (dấu cơ quan điện tử) vào văn bản",
      action: "organization-sign",
      variant: "primary",
      icon: Stamp,
    },
  ],
  ISSUED: [],
};

// Alias: organization-sign triggers from NUMBERED status in service
// After NUMBERED, next step is ORGANIZATION_SIGNED, then ISSUED

export interface OutgoingActionPanelProps {
  documentId: string;
  status: OutgoingDocumentStatus;
  currentUserId: string;
  className?: string;
  onActionSuccess?: () => void;
}

export function OutgoingActionPanel({
  documentId,
  status,
  currentUserId: _currentUserId,
  className,
  onActionSuccess,
}: OutgoingActionPanelProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<ActionDef | null>(null);
  const [note, setNote] = React.useState("");

  const actions = STATUS_ACTIONS[status] ?? [];

  async function executeAction(actionDef: ActionDef, noteValue?: string) {
    setPending(actionDef.action);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, string> = {};
      if (noteValue) body.notes = noteValue;

      const res = await fetch(`/api/documents/${documentId}/actions/${actionDef.action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Thao tác thất bại (${res.status})`);
      }

      setSuccess(`${actionDef.label} thành công.`);
      onActionSuccess?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setPending(null);
      setConfirmAction(null);
      setNote("");
    }
  }

  function handleActionClick(actionDef: ActionDef) {
    setError(null);
    setSuccess(null);
    if (actionDef.requiresNote) {
      setNote("");
      setConfirmAction(actionDef);
    } else {
      setConfirmAction(actionDef);
    }
  }

  if (actions.length === 0) {
    if (status === "ISSUED") {
      return (
        <div
          className={cn(
            "rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-center",
            className
          )}
        >
          <CheckCircle2 className="mx-auto size-8 text-emerald-500 mb-2" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-emerald-800">Văn bản đã phát hành</p>
          <p className="mt-1 text-xs text-emerald-600">Quy trình xử lý hoàn tất.</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={cn("rounded-xl border border-border/70 bg-card p-4 shadow-xs", className)}>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Hành động
      </h3>

      <div className="space-y-2">
        {actions.map((actionDef) => {
          const Icon = actionDef.icon;
          const isLoading = pending === actionDef.action;

          return (
            <button
              key={actionDef.action}
              type="button"
              disabled={!!pending}
              onClick={() => handleActionClick(actionDef)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
                actionDef.variant === "primary"
                  ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 active:scale-[0.98]"
                  : actionDef.variant === "danger"
                    ? "border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 active:scale-[0.98]"
                    : "border-border bg-muted/50 text-foreground hover:bg-muted active:scale-[0.98]"
              )}
            >
              {isLoading ? (
                <Loader2 className="size-4 shrink-0 animate-spin" strokeWidth={1.5} />
              ) : (
                <Icon className="size-4 shrink-0" strokeWidth={1.5} />
              )}
              <div className="flex-1 min-w-0">
                <div>{actionDef.label}</div>
                <div className="text-[10px] font-normal opacity-70 leading-snug mt-0.5">
                  {actionDef.description}
                </div>
              </div>
              <ChevronRight className="size-3.5 shrink-0 opacity-40" strokeWidth={1.5} />
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-2.5 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-700">
          <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>{success}</span>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog.Root
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
            setNote("");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
          <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
              {confirmAction && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    {React.createElement(confirmAction.icon, {
                      className: cn(
                        "size-4 shrink-0",
                        confirmAction.variant === "danger"
                          ? "text-destructive"
                          : "text-primary"
                      ),
                      strokeWidth: 1.5,
                    })}
                    <Dialog.Title className="text-sm font-semibold text-foreground">
                      {confirmAction.label}
                    </Dialog.Title>
                  </div>
                  <Dialog.Description className="text-xs text-muted-foreground mb-4">
                    {confirmAction.description}
                  </Dialog.Description>

                  {confirmAction.requiresNote && (
                    <div className="mb-4">
                      <label className="text-xs font-medium text-foreground mb-1.5 block">
                        Ghi chú / Lý do <span className="text-destructive">*</span>
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        placeholder="Nhập lý do hoặc ghi chú..."
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <Dialog.Close
                      render={
                        <button
                          type="button"
                          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                        />
                      }
                    >
                      Hủy
                    </Dialog.Close>
                    <button
                      type="button"
                      disabled={confirmAction.requiresNote && !note.trim()}
                      onClick={() => executeAction(confirmAction, note || undefined)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 disabled:pointer-events-none",
                        confirmAction.variant === "danger"
                          ? "bg-destructive hover:bg-destructive/90"
                          : "bg-primary hover:bg-primary/90"
                      )}
                    >
                      {pending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Send className="size-3" strokeWidth={2} />
                      )}
                      Xác nhận
                    </button>
                  </div>
                </>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
