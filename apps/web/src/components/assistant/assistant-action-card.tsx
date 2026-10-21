"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BellRing, Bookmark, Check, CircleDot, FileText, MessageSquare, Minus, TriangleAlert } from "lucide-react";
import type { AssistantActionDecision, AssistantActionDTO, AssistantActionView } from "@qcet/contracts/assistant";
import {
  ASSISTANT_ACTION_STATUS_LABEL,
  assistantActionHeading,
  assistantActionResult,
  assistantActionTarget,
  assistantTaskStatusLabel,
  describeAssistantAction,
} from "@qcet/shared/domain/assistant/assistant-actions";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { assistantErrorText, decideActionRequest } from "@/components/assistant/assistant-client";
import { MinutesText } from "@/components/meetings/minutes-text";
import { cn } from "@/lib/utils";

const APPROVE_LABEL: Record<AssistantActionView["kind"], string> = {
  task_comment: "Đăng bình luận",
  task_status: "Đổi trạng thái",
  task_remind: "Gửi lời nhắc",
  memory_save: "Lưu ghi nhớ",
  meeting_minutes: "Lưu dự thảo biên bản",
};
const DECIDE_FAILED = "Chưa gửi được quyết định. Thầy/Cô thử lại.";

function KindIcon({ kind, className }: { kind: AssistantActionView["kind"]; className?: string }) {
  if (kind === "task_comment") return <MessageSquare className={className} aria-hidden />;
  if (kind === "task_status") return <CircleDot className={className} aria-hidden />;
  if (kind === "task_remind") return <BellRing className={className} aria-hidden />;
  if (kind === "meeting_minutes") return <FileText className={className} aria-hidden />;
  return <Bookmark className={className} aria-hidden />;
}

/** Trang của đối tượng thẻ tác động, cho nút "Mở …" sau khi đã thực hiện. */
function targetLink(view: AssistantActionView): { href: string; label: string } | null {
  if ("task" in view) return { href: `/tasks/${encodeURIComponent(view.task.id)}`, label: "Mở nhiệm vụ" };
  if ("meeting" in view) return { href: `/meetings/${encodeURIComponent(view.meeting.id)}`, label: "Mở cuộc họp" };
  return null;
}

/** Hậu quả của việc duyệt, đặt ngay trên nút: chỉ thẻ không hoàn tác được mới cần nói (các thẻ khác có "Hoàn tác"). */
function consequenceOf(view: AssistantActionView): { text: string; warn: boolean } | null {
  if (view.kind !== "meeting_minutes") return null;
  return view.replaces
    ? { text: "Thay dự thảo đang có của cuộc họp. Không hoàn tác được.", warn: true }
    : { text: "Lưu vào cuộc họp làm dự thảo để chủ tọa duyệt. Không hoàn tác được.", warn: false };
}

/**
 * Thẻ hành động do Trợ lý soạn (ADR-012): ghi rõ đối tượng và nội dung nguyên văn sẽ gửi, nút chính nói đúng việc sẽ làm
 * ("Đăng bình luận"), "Bỏ qua" nhẹ bên cạnh. Chưa duyệt thì chưa có gì thay đổi; đã xử lý thì thu gọn một hàng, còn hoàn
 * tác được thì có "Hoàn tác". Máy chủ kiểm quyền lại khi duyệt.
 *
 * Thứ bậc chú ý (người dùng 21/10/2026 "research cải thiện ui ux; đặc biệt attention"; theo Approval card của Hightouch UI
 * và các hướng dẫn human-in-the-loop): thẻ chờ duyệt là chỗ duy nhất cần Thầy/Cô ra quyết định nên viền và dòng "Chờ
 * Thầy/Cô duyệt" màu chính; tiêu đề là quyết định, đối tượng một dòng riêng xuống tối đa 2 dòng (không cắt "…" giữa tên);
 * hậu quả ("Không hoàn tác được") nằm sát nút. Đã xử lý thì lùi về viền thường, tiêu đề nói việc đã làm, và tiêu điểm
 * chuyển về thẻ nếu đang ở nút vừa bấm.
 */
export function AssistantActionCard({ action, onChange }: { action: AssistantActionDTO; onChange?: (action: AssistantActionDTO) => void }) {
  const [busy, setBusy] = React.useState<AssistantActionDecision | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const cardRef = React.useRef<HTMLElement>(null);
  const view = action.view;
  const title = describeAssistantAction(view);
  const link = targetLink(view);
  const target = assistantActionTarget(view);

  const decide = async (decision: AssistantActionDecision) => {
    if (busy) return;
    setBusy(decision);
    setError(null);
    // Nút vừa bấm biến mất khi thẻ thu gọn: đưa tiêu điểm về thẻ thay vì rơi xuống body
    const hadFocus = Boolean(cardRef.current?.contains(document.activeElement));
    try {
      const next = await decideActionRequest(action.id, decision);
      onChange?.(next);
      if (hadFocus) requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: true }));
      // Biên bản vừa lưu: trang cuộc họp đang nằm dưới khung chat tải lại dữ liệu để hiện ngay, không phải tự tải lại
      if (next.status === "done" && view.kind === "meeting_minutes") router.refresh();
    } catch (failure) {
      setError(assistantErrorText(failure, DECIDE_FAILED));
    } finally {
      setBusy(null);
    }
  };

  if (action.status !== "pending") {
    const done = action.status === "done";
    const failed = action.status === "failed";
    const heading = done ? assistantActionResult(view) : assistantActionHeading(view);
    const detail = failed
      ? action.error || ASSISTANT_ACTION_STATUS_LABEL.failed
      : done
        ? target
        : [ASSISTANT_ACTION_STATUS_LABEL[action.status], target].filter(Boolean).join(" · ");
    return (
      <div className="flex flex-col gap-1.5">
        <section
          ref={cardRef}
          tabIndex={-1}
          aria-label={`${title}: ${ASSISTANT_ACTION_STATUS_LABEL[action.status]}`}
          className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 outline-none"
        >
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
            <p className={cn("break-words text-compact", done ? "font-medium text-foreground" : "text-muted-foreground")}>{heading}</p>
            {detail ? (
              failed ? (
                <p className="break-words text-xs text-destructive">{detail}</p>
              ) : (
                <p className="line-clamp-2 break-words text-xs text-muted-foreground" title={detail}>
                  {detail}
                </p>
              )
            ) : null}
          </div>
          {action.undoable && onChange ? (
            <Button variant="ghost" size="sm" className="shrink-0 max-md:min-h-11" disabled={busy !== null} onClick={() => void decide("undo")}>
              {busy === "undo" ? "Đang hoàn tác…" : "Hoàn tác"}
            </Button>
          ) : null}
          {link && done ? (
            <Button asChild variant="ghost" size="sm" className="shrink-0 text-foreground max-md:min-h-11">
              <Link href={link.href}>
                {link.label}
                <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          ) : null}
        </section>
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  const consequence = consequenceOf(view);
  return (
    <section ref={cardRef} tabIndex={-1} aria-label={`Thẻ chờ duyệt: ${title}`} className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-background p-3 outline-none">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <KindIcon kind={view.kind} className="size-3.5 shrink-0" />
          Chờ Thầy/Cô duyệt
        </p>
        <p className="break-words text-compact font-medium text-foreground">{assistantActionHeading(view)}</p>
        {target ? (
          <p className="line-clamp-2 break-words text-xs text-muted-foreground" title={target}>
            {target}
          </p>
        ) : null}
        {view.kind === "meeting_minutes" && view.recording ? (
          <p className="truncate text-xs text-muted-foreground" title={view.recording.name}>
            Từ bản ghi “{view.recording.name}”
          </p>
        ) : null}
      </div>

      <ActionDetail view={view} />

      <div className="flex flex-col gap-2">
        {consequence ? <p className={cn("text-xs", consequence.warn ? "text-warning" : "text-muted-foreground")}>{consequence.text}</p> : null}
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
  if (view.kind === "meeting_minutes") {
    // Chỗ nghe chưa chắc đứng trước biên bản, sát chỗ ra quyết định (trước đây nằm ở gạch cuối câu trả lời, dễ bị bỏ qua);
    // rồi đủ nguyên văn biên bản sẽ lưu, dựng có cấu trúc như trên trang cuộc họp, dài thì cuộn trong thẻ
    return (
      <div className="flex flex-col gap-3">
        {view.checks?.length ? (
          <div className="flex flex-col gap-1">
            <InlineAlert variant="warning">Cần kiểm lại trước khi lưu</InlineAlert>
            <ul className="flex list-disc flex-col gap-0.5 pl-5 text-xs text-foreground">
              {view.checks.map((item, index) => (
                <li key={index} className="break-words">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="thin-scrollbar max-h-80 overflow-y-auto rounded-md bg-muted px-3 py-2.5">
          <MinutesText text={view.minutes} />
        </div>
      </div>
    );
  }
  const text = view.kind === "task_comment" ? view.body : view.content;
  return (
    <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted px-2.5 py-2 text-compact text-foreground">{text}</p>
  );
}
