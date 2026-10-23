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
  Undo2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { StandardDialog } from "@/components/ui/dialog";
import type { OutgoingDocumentStatus } from "@qcet/contracts/documents";
import type { OutgoingReturned, OutgoingStepSlug, OutgoingStepView } from "@qcet/contracts/types/document";
import { OUTGOING_STEP_ACTIONS } from "@qcet/shared/domain/documents/outgoing-steps";
import { readApiErrorMessage } from "@/lib/documents/api-error";
import { refreshWorkQueue } from "@/lib/documents/work-queue";
import { OutgoingSubmitDialog } from "./outgoing-submit-dialog";
import { OutgoingAssignNumberDialog } from "./outgoing-assign-number-dialog";
import { formatDateTime } from "@/lib/format";

import { Spinner } from "@/components/ui/spinner";
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
    description: "Chọn người duyệt và gửi dự thảo để phê duyệt nội dung",
    variant: "primary",
    icon: ClipboardCheck,
  },
  "withdraw-content-review": {
    label: "Rút lại",
    description: "Đưa dự thảo về Nháp để sửa; người duyệt sẽ không còn thấy việc này",
    variant: "secondary",
    icon: Undo2,
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
    label: "Xác nhận ký",
    description: "Xác nhận thẩm quyền ban hành; hệ thống chưa ký số bằng chứng thư",
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
    description: "Xác nhận đóng dấu cơ quan; hệ thống chưa gắn dấu điện tử bằng chứng thư",
    variant: "primary",
    icon: Stamp,
  },
};

/** Bước cần nhập lý do (gửi trong `notes`), lấy từ bảng thao tác chung để khớp với route. */
const NOTE_REQUIRED = new Set<string>(
  Object.values(OUTGOING_STEP_ACTIONS)
    .flat()
    .filter((step) => step?.requiresNote)
    .map((step) => step!.action)
);

function actionDef(slug: OutgoingStepSlug): ActionDef {
  return { ...ACTION_UI[slug], action: slug, requiresNote: NOTE_REQUIRED.has(slug) };
}

/** Ai đang giữ bước và từ khi nào: "Đang chờ <ai> <việc> · từ <ngày giờ>". */
function WaitingLine({ waiting }: { waiting: NonNullable<OutgoingStepView["waiting"]> }) {
  return (
    <p className="flex items-center gap-1.5 text-compact text-muted-foreground">
      <Clock className="size-4 shrink-0" aria-hidden />
      <span>
        Đang chờ <span className="font-medium text-foreground">{waiting.who}</span> {waiting.task}
        {waiting.since ? <span className="tabular-nums"> · từ {formatDateTime(waiting.since)}</span> : null}
      </span>
    </p>
  );
}

/** Dự thảo bị người duyệt trả lại: ai trả, khi nào và lý do, ngay đầu khối thao tác để người soạn biết cần sửa gì. */
function ReturnedNotice({ returned }: { returned: OutgoingReturned }) {
  const meta = [returned.by, returned.at ? formatDateTime(returned.at) : null].filter(Boolean).join(" · ");
  return (
    <div role="note" className="rounded-sm bg-warning/10 px-3 py-2 text-compact">
      <p className="flex flex-wrap items-center gap-x-1.5 font-medium text-warning">
        <RotateCcw className="size-4 shrink-0" aria-hidden />
        Bị trả lại để sửa
        {meta ? <span className="font-normal tabular-nums text-muted-foreground">· {meta}</span> : null}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-body-foreground">
        {returned.note ?? "Người duyệt không ghi lý do."}
      </p>
    </div>
  );
}

export interface OutgoingActionPanelProps {
  documentId: string;
  status: OutgoingDocumentStatus;
  /** Server tính theo người xem: thao tác của bước đang chờ mà họ được làm, và ai đang giữ bước. */
  step: OutgoingStepView | null | undefined;
  className?: string;
  onActionSuccess?: () => void;
}

export function OutgoingActionPanel({
  documentId,
  status,
  step,
  className,
  onActionSuccess,
}: OutgoingActionPanelProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<ActionDef | null>(null);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [assignNumberOpen, setAssignNumberOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  const actions = (step?.actions ?? []).map(actionDef);
  const waiting = step?.waiting ?? null;
  const notice = step?.returned ? <ReturnedNotice returned={step.returned} /> : null;

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

      if (!res.ok) throw new Error(await readApiErrorMessage(res, `Thao tác thất bại (${res.status})`));

      setSuccess(`${actionDef.label} thành công.`);
      onActionSuccess?.();
      void refreshWorkQueue({ force: true });
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
    // Trình duyệt có hộp riêng: chọn người duyệt và lời nhắn thay cho hộp xác nhận trần
    if (actionDef.action === "submit-content-review") {
      setSubmitOpen(true);
      return;
    }
    // Cấp số có hộp riêng: xem trước số, sửa ký hiệu và ngày ban hành
    if (actionDef.action === "assign-number") {
      setAssignNumberOpen(true);
      return;
    }
    if (actionDef.requiresNote) {
      setNote("");
      setConfirmAction(actionDef);
    } else {
      setConfirmAction(actionDef);
    }
  }

  if (actions.length === 0) {
    // Chưa đến lượt người xem: nói ai đang giữ bước thay vì hiện nút sẽ bị từ chối
    if (waiting) {
      return (
        <div className={cn("space-y-2", className)}>
          {notice}
          <WaitingLine waiting={waiting} />
        </div>
      );
    }
    if (status === "ISSUED") {
      return (
        <p className={cn("flex items-center gap-1.5 text-compact text-muted-foreground", className)}>
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          Văn bản đã phát hành · quy trình xử lý hoàn tất
        </p>
      );
    }
    return notice ? <div className={className}>{notice}</div> : null;
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
      <h3 className="text-xs font-semibold text-muted-foreground mb-2">Hành động</h3>
      {notice ? <div className="mb-2">{notice}</div> : null}
      {waiting ? <div className="mb-2"><WaitingLine waiting={waiting} /></div> : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((actionDef) => {
          const isLoading = pending === actionDef.action;

          return (
            <Button
              key={actionDef.action}
              size="sm"
              variant={actionDef.variant === "primary" ? "default" : "ghost"}
              disabled={!!pending}
              onClick={() => handleActionClick(actionDef)}
              title={actionDef.description}
              aria-description={actionDef.description}
              className={cn("text-compact", actionDef.variant === "danger" && "text-destructive hover:text-destructive")}
            >
              {isLoading ? (
                <Spinner size="md" className="motion-reduce:animate-none" />
              ) : null}
              {actionDef.label}
            </Button>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="mt-2 flex items-start gap-1.5 rounded-md bg-danger-soft p-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div role="status" className="mt-2 flex items-start gap-1.5 rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-700">
          <CheckCircle2 className="size-3.5 shrink-0 mt-px" />
          <span>{success}</span>
        </div>
      )}

      <OutgoingAssignNumberDialog
        open={assignNumberOpen}
        onOpenChange={setAssignNumberOpen}
        documentId={documentId}
        onAssigned={(numberStr) => {
          setSuccess(numberStr ? `Đã cấp số ${numberStr}.` : "Đã cấp số.");
          onActionSuccess?.();
          void refreshWorkQueue({ force: true });
          router.refresh();
        }}
      />

      <OutgoingSubmitDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        documentId={documentId}
        reviewers={step?.reviewers ?? []}
        onSubmitted={(reviewer) => {
          setSuccess(reviewer ? `Đã gửi ${reviewer.name} duyệt nội dung.` : "Đã gửi duyệt nội dung.");
          onActionSuccess?.();
          void refreshWorkQueue({ force: true });
          router.refresh();
        }}
      />

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
              <Button variant="outline" size="sm" onClick={() => { setConfirmAction(null); setNote(""); }}>
                Hủy
              </Button>
              <Button
                size="sm"
                variant={confirmAction.variant === "danger" ? "destructive" : "default"}
                disabled={(confirmAction.requiresNote && !note.trim()) || !!pending}
                onClick={() => executeAction(confirmAction, note || undefined)}
              >
                {pending ? (
                  <Spinner size="md" />
                ) : (
                  <Send />
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
