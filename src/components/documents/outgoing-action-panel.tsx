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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { StandardDialog } from "@/components/ui/dialog";
import type { OutgoingDocumentStatus } from "@/contracts/documents";
import { OUTGOING_STEP_ACTIONS } from "@/lib/documents/outgoing-step-actions";

interface ActionDef {
  label: string;
  description: string;
  action: string;
  variant: "primary" | "danger" | "secondary";
  icon: React.ElementType;
  requiresNote?: boolean;
}

const ACTION_UI: Record<string, Omit<ActionDef, "action" | "requiresNote">> = {
  "submit-content-review": {
    label: "Trình phê duyệt nội dung",
    description: "Gửi dự thảo lên Trưởng đơn vị để phê duyệt nội dung",
    variant: "primary",
    icon: ClipboardCheck,
  },
  "approve-content": {
    label: "Phê duyệt nội dung",
    description: "Xác nhận nội dung văn bản đạt yêu cầu",
    variant: "primary",
    icon: CheckCircle2,
  },
  "reject-content": {
    label: "Yêu cầu chỉnh sửa",
    description: "Trả lại dự thảo để chỉnh sửa nội dung",
    variant: "danger",
    icon: RotateCcw,
  },
  "approve-format": {
    label: "Xác nhận thể thức đạt",
    description: "Kiểm tra thể thức, kỹ thuật trình bày theo NĐ 30/2020",
    variant: "primary",
    icon: FileCheck,
  },
  sign: {
    label: "Ký chức danh",
    description: "Ký số xác nhận thẩm quyền ban hành",
    variant: "primary",
    icon: PenLine,
  },
  "assign-number": {
    label: "Cấp số & ngày ban hành",
    description: "Cấp số văn bản đi liên tục và xác nhận ngày ban hành",
    variant: "secondary",
    icon: Hash,
  },
  "organization-sign": {
    label: "Đóng dấu cơ quan",
    description: "Ký số tổ chức (dấu cơ quan điện tử) vào văn bản",
    variant: "primary",
    icon: Stamp,
  },
};

/** Nút theo trạng thái, lấy từ bảng thao tác chung để khớp với route và máy trạng thái. */
const STATUS_ACTIONS: Partial<Record<OutgoingDocumentStatus, ActionDef[]>> = Object.fromEntries(
  Object.entries(OUTGOING_STEP_ACTIONS).map(([status, list]) => [
    status,
    (list ?? []).map((step) => ({ ...ACTION_UI[step.action], action: step.action, requiresNote: step.requiresNote })),
  ])
);

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
        <p className={cn("flex items-center gap-1.5 text-compact text-muted-foreground", className)}>
          <CheckCircle2 className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Văn bản đã phát hành · quy trình xử lý hoàn tất
        </p>
      );
    }
    return null;
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
      <h3 className="text-xs font-semibold text-muted-foreground mb-2">Hành động</h3>

      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((actionDef) => {
          const isLoading = pending === actionDef.action;

          return (
            <Button
              key={actionDef.action}
              type="button"
              size="sm"
              variant={actionDef.variant === "primary" ? "default" : "ghost"}
              disabled={!!pending}
              onClick={() => handleActionClick(actionDef)}
              title={actionDef.description}
              aria-description={actionDef.description}
              className={cn("text-compact", actionDef.variant === "danger" && "text-destructive hover:text-destructive")}
            >
              {isLoading ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
              ) : null}
              {actionDef.label}
            </Button>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="mt-2 flex items-start gap-1.5 rounded-md bg-danger-soft p-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0 mt-px" strokeWidth={1.5} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div role="status" className="mt-2 flex items-start gap-1.5 rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-700">
          <CheckCircle2 className="size-3.5 shrink-0 mt-px" strokeWidth={1.5} />
          <span>{success}</span>
        </div>
      )}

      {/* Confirmation Dialog */}
      <StandardDialog
      compact
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
            setNote("");
          }
        }}
        title={confirmAction?.label ?? "Xác nhận thao tác"}
        description={confirmAction?.description}
        size="sm"
      >
        {confirmAction && (
          <div className="space-y-3">
            {confirmAction.requiresNote && (
              <FormField label="Ghi chú / lý do">
                <Textarea
                  compact
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Nhập lý do hoặc ghi chú..."
                  className="resize-none"
                />
              </FormField>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => { setConfirmAction(null); setNote(""); }}>
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                variant={confirmAction.variant === "danger" ? "destructive" : "default"}
                disabled={(confirmAction.requiresNote && !note.trim()) || !!pending}
                onClick={() => executeAction(confirmAction, note || undefined)}
              >
                {pending ? (
                  <Loader2 className="animate-spin" strokeWidth={1.5} />
                ) : (
                  <Send strokeWidth={1.5} />
                )}
                Xác nhận
              </Button>
            </div>
          </div>
        )}
      </StandardDialog>
    </div>
  );
}
