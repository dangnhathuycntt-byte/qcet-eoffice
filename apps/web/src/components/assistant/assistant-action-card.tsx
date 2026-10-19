"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BellRing, Bookmark, Check, CircleDot, MessageSquare, Minus, TriangleAlert } from "lucide-react";
import type { AssistantActionDecision, AssistantActionDTO, AssistantActionView } from "@qcet/contracts/assistant";
import {
  ASSISTANT_ACTION_STATUS_LABEL,
  assistantTaskStatusLabel,
  describeAssistantAction,
} from "@qcet/shared/domain/assistant/assistant-actions";
import { Button } from "@/components/ui/button";
import { assistantErrorText, decideActionRequest } from "@/components/assistant/assistant-client";

const APPROVE_LABEL: Record<AssistantActionView["kind"], string> = {
  task_comment: "Đăng bình luận",
  task_status: "Đổi trạng thái",
  task_remind: "Gửi lời nhắc",
  memory_save: "Lưu ghi nhớ",
};
const DECIDE_FAILED = "Chưa gửi được quyết định. Thầy/Cô thử lại.";

function KindIcon({ kind, className }: { kind: AssistantActionView["kind"]; className?: string }) {
  if (kind === "task_comment") return <MessageSquare className={className} aria-hidden />;
  if (kind === "task_status") return <CircleDot className={className} aria-hidden />;
  if (kind === "task_remind") return <BellRing className={className} aria-hidden />;
  return <Bookmark className={className} aria-hidden />;
}

function taskHref(view: AssistantActionView): string | null {
  return "task" in view ? `/tasks/${encodeURIComponent(view.task.id)}` : null;
}

/**
 * Thẻ hành động do Trợ lý soạn (ADR-012), cùng mẫu với thẻ đề xuất nhiệm vụ: ghi rõ đối tượng và nội dung nguyên văn sẽ
 * gửi, nút chính nói đúng việc sẽ làm ("Đăng bình luận"), "Bỏ qua" nhẹ bên cạnh. Chưa duyệt thì chưa có gì thay đổi; đã
 * xử lý thì thu gọn một hàng, còn hoàn tác được thì có "Hoàn tác". Máy chủ kiểm quyền lại khi duyệt.
 */
export function AssistantActionCard({ action, onChange }: { action: AssistantActionDTO; onChange?: (action: AssistantActionDTO) => void }) {
  const [busy, setBusy] = React.useState<AssistantActionDecision | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const view = action.view;
  const title = describeAssistantAction(view);
  const href = taskHref(view);

  const decide = async (decision: AssistantActionDecision) => {
    if (busy) return;
    setBusy(decision);
    setError(null);
    try {
      onChange?.(await decideActionRequest(action.id, decision));
    } catch (failure) {
      setError(assistantErrorText(failure, DECIDE_FAILED));
    } finally {
      setBusy(null);
    }
  };

  if (action.status !== "pending") {
    const done = action.status === "done";
    const failed = action.status === "failed";
    return (
      <div className="flex flex-col gap-1.5">
        <section aria-label={`${title}: ${ASSISTANT_ACTION_STATUS_LABEL[action.status]}`} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden>
            {done ? (
              <Check className="size-3.5 text-foreground" />
            ) : failed ? (
              <TriangleAlert className="size-3.5 text-destructive" />
            ) : (
              <Minus className="size-3.5 text-muted-foreground" />
            )}
          </span>
          <div role="status" className="flex min-w-0 flex-1 flex-col">
            <p className={done ? "truncate text-compact font-medium text-foreground" : "truncate text-compact text-muted-foreground"} title={title}>
              {title}
            </p>
            <p className={failed ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {failed && action.error ? action.error : ASSISTANT_ACTION_STATUS_LABEL[action.status]}
            </p>
          </div>
          {action.undoable && onChange ? (
            <Button variant="ghost" size="sm" className="shrink-0 max-md:min-h-11" disabled={busy !== null} onClick={() => void decide("undo")}>
              {busy === "undo" ? "Đang hoàn tác…" : "Hoàn tác"}
            </Button>
          ) : null}
          {href && done ? (
            <Button asChild variant="ghost" size="sm" className="shrink-0 text-foreground max-md:min-h-11">
              <Link href={href}>
                Mở nhiệm vụ
                <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          ) : null}
        </section>
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <section aria-label={`Thẻ chờ duyệt: ${title}`} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <KindIcon kind={view.kind} className="size-3.5 shrink-0" />
          Chờ Thầy/Cô duyệt
        </p>
        <p className="break-words text-compact font-medium text-foreground">{title}</p>
        {"task" in view ? (
          <p className="truncate text-xs text-muted-foreground" title={view.task.title}>
            {view.task.title}
          </p>
        ) : null}
      </div>

      <ActionDetail view={view} />

      <div className="flex flex-col gap-2">
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        {onChange ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" className="max-md:min-h-11" disabled={busy !== null} onClick={() => void decide("reject")}>
              Bỏ qua
            </Button>
            <Button size="sm" className="max-md:min-h-11" disabled={busy !== null} onClick={() => void decide("approve")}>
              {busy === "approve" ? "Đang thực hiện…" : APPROVE_LABEL[view.kind]}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Nội dung nguyên văn sẽ gửi hoặc ghi: người dùng đọc đúng điều sẽ xảy ra trước khi duyệt. */
function ActionDetail({ view }: { view: AssistantActionView }) {
  if (view.kind === "task_status") {
    return (
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Hiện tại</dt>
        <dd className="text-foreground">{assistantTaskStatusLabel(view.from)}</dd>
        <dt className="text-muted-foreground">Đổi sang</dt>
        <dd className="font-medium text-foreground">{assistantTaskStatusLabel(view.to)}</dd>
      </dl>
    );
  }
  if (view.kind === "task_remind") {
    return (
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Gửi tới</dt>
        <dd className="text-foreground">{view.recipients.join(", ")}</dd>
        <dt className="text-muted-foreground">Lời nhắc</dt>
        <dd className="whitespace-pre-wrap break-words text-foreground">{view.message}</dd>
      </dl>
    );
  }
  const text = view.kind === "task_comment" ? view.body : view.content;
  return (
    <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted px-2.5 py-2 text-compact text-foreground">{text}</p>
  );
}
