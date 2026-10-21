"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, BookmarkPlus, FileText, Pencil, RotateCcw } from "lucide-react";
import { ASSISTANT_MESSAGE_MAX, type AssistantActionDTO, type AssistantSourceRef, type AssistantTaskProposal } from "@qcet/contracts/assistant";
import { agentReplyToPlainText } from "@qcet/shared/domain/tasks/agent-reply-format";
import { AgentReplyText, AgentWorkLog, CopyMessageButton } from "@/components/agent-chat/agent-chat-parts";
import { AttachmentCard, StoredAttachmentCard } from "@/components/agent-chat/agent-attachments";
import { useSmoothText } from "@/components/agent-chat/use-smooth-text";
import { Button } from "@/components/ui/button";
import { focusRingClass } from "@/components/ui/focus-ring";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ASSISTANT_NO_ANSWER_MESSAGE,
  followUpSuggestions,
  formatDurationVi,
  isSendKey,
  questionMessageBefore,
  type FollowUpSuggestion,
  type ProposalTarget,
  type ThreadMessage,
} from "@/components/assistant/assistant-model";
import type { DetailStatus } from "@/components/assistant/use-assistant-chat";
import { useElapsedSeconds } from "@/components/assistant/use-elapsed-seconds";
import { AssistantProposalList, AssistantTaskProposalCard, PROPOSAL_LIST_MIN } from "@/components/assistant/assistant-task-proposal-card";
import { AssistantActionCard } from "@/components/assistant/assistant-action-card";

const MAX_SHOWN_SOURCES = 6;
const ENTER_MOTION = "motion-safe:animate-[fade-in_0.3s_cubic-bezier(0.16,1,0.3,1)]";

export interface AssistantThreadProps {
  thread: ThreadMessage[];
  detailStatus: DetailStatus;
  detailError: string | null;
  onRetry: (replyKey: string) => void;
  onNewChat: () => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  /** Mục mà cuộc trò chuyện này hỏi về; hiện một dòng nhỏ đầu cột để mở lại. */
  context?: AssistantSourceRef | null;
  /** Đang có lượt chạy: nút "Thử lại" của tin lỗi cũ ẩn đi, vì lượt mới sẽ bị bỏ qua. */
  pending?: boolean;
  /** Khung chat nổi 400px: lề ngang 16px, không căn giữa theo cột 752px. */
  compact?: boolean;
  /** Mở hộp tạo nhiệm vụ đã điền theo thẻ đề xuất thứ `index` của tin `replyKey`; không truyền thì thẻ không có nút. */
  onOpenProposal?: (target: ProposalTarget) => void;
  /** Bỏ qua (hoặc hoàn tác bỏ qua) thẻ đề xuất thứ `index` của tin `replyKey`; không truyền thì thẻ không có nút Bỏ qua. */
  onDismissProposal?: (replyKey: string, index: number, dismissed: boolean) => void;
  /** Bỏ qua (hoặc hoàn tác) nhiều thẻ của tin `replyKey` một lần (thẻ danh sách); không truyền thì gọi từng thẻ. */
  onDismissProposals?: (replyKey: string, indexes: number[], dismissed: boolean) => void;
  /** "Tạo tất cả" trên thẻ danh sách (từ PROPOSAL_LIST_MIN đề xuất): mở hộp tạo các đề xuất còn chờ của tin đó. */
  onCreateProposals?: (items: ProposalTarget[]) => void;
  /** Gửi câu của gợi ý bước tiếp theo dưới tin trả lời cuối; không truyền thì không có gợi ý. */
  onFollowUp?: (prompt: string) => void;
  /** "Tạo lại" câu trả lời cuối (thay cặp hỏi–đáp cuối); không truyền thì không có nút. */
  onRegenerate?: () => void;
  /** Gửi câu hỏi cuối đã sửa (thay cặp hỏi–đáp cuối); không truyền thì câu hỏi không sửa được. */
  onEditQuestion?: (text: string) => void;
  /** Thẻ hành động vừa được duyệt, bỏ qua hay hoàn tác (ADR-012); không truyền thì thẻ chỉ để xem. */
  onActionChange?: (action: AssistantActionDTO) => void;
  /** "Lưu thành kỹ năng" trên câu hỏi; không truyền thì không có nút. */
  onSaveSkill?: (text: string) => void;
}

export type { ProposalTarget } from "@/components/assistant/assistant-model";

/** Cách đáy quá chừng này (px) thì hiện nút cuộn xuống tin mới nhất. */
const SCROLL_BUTTON_OFFSET = 160;
/** Lượt chạy quá chừng này (giây) mới hiện đồng hồ, để câu trả lời nhanh không nhấp nháy "1 giây, 2 giây". */
const SHOW_ELAPSED_AFTER_SECONDS = 5;

/**
 * Cột tin của cuộc đang mở: cuộn được, căn giữa, rộng tối đa 720px. Màn đầu (chưa có tin) do khung cha lo. Kéo lên đọc
 * thì có nút tròn ở đáy để về tin mới nhất (như ChatGPT, Claude), cột thôi bám đáy tới khi về lại đáy.
 */
export function AssistantThread({
  thread,
  detailStatus,
  detailError,
  onRetry,
  onNewChat,
  listRef,
  onScroll,
  context = null,
  pending = false,
  compact = false,
  onOpenProposal,
  onDismissProposal,
  onDismissProposals,
  onCreateProposals,
  onFollowUp,
  onRegenerate,
  onEditQuestion,
  onActionChange,
  onSaveSkill,
}: AssistantThreadProps) {
  const [awayFromBottom, setAwayFromBottom] = React.useState(false);
  const handleScroll = () => {
    onScroll();
    const el = listRef.current;
    if (el) setAwayFromBottom(el.scrollHeight - el.scrollTop - el.clientHeight > SCROLL_BUTTON_OFFSET);
  };
  // "Tạo lại"/"Sửa" chỉ cho cặp hỏi–đáp cuối, khi câu trả lời đã xong và câu hỏi đã có mã ở máy chủ. Câu trả lời có đề
  // xuất đã thành nhiệm vụ thì không: thay nó sẽ làm mất dấu "Đã tạo NV-…" trong cuộc (nhiệm vụ vẫn còn)
  const last = thread[thread.length - 1];
  const lastReply = !pending && last?.role === "assistant" && last.status !== "streaming" ? last : null;
  const lastQuestion = lastReply ? questionMessageBefore(thread, lastReply.key) : null;
  // Thẻ hành động đã thực hiện cũng vậy: thay câu trả lời thì mất dấu việc đã làm
  const replaceable =
    Boolean(lastQuestion?.id) &&
    Object.keys(lastReply?.proposalTasks ?? {}).length === 0 &&
    !lastReply?.actions?.some((action) => action.status === "done");
  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  };
  return (
    <div ref={listRef} onScroll={handleScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-slot="assistant-thread">
      <div className={cn("mx-auto flex w-full flex-col gap-6", compact ? "px-4 py-4" : "max-w-[752px] px-4 py-6 md:px-6")}>
        {context ? (
          <Link
            href={context.href}
            className={cn("w-fit max-w-full truncate rounded-xs text-xs text-muted-foreground hover:text-foreground", focusRingClass)}
          >
            {[context.code, context.title].filter(Boolean).join(" ")}
          </Link>
        ) : null}

        {detailStatus === "loading" ? (
          <p role="status" className="text-xs text-muted-foreground">
            Đang mở cuộc trò chuyện…
          </p>
        ) : null}

        {detailStatus === "error" ? (
          <div className="flex flex-col items-start gap-2 py-8">
            <InlineAlert variant="error">{detailError}</InlineAlert>
            <Button variant="outline" size="sm" onClick={onNewChat} className="max-md:h-11">
              Cuộc trò chuyện mới
            </Button>
          </div>
        ) : null}

        {thread.map((message, index) =>
          message.role === "user" ? (
            <UserTurn
              key={message.key}
              message={message}
              onEdit={replaceable && message.key === lastQuestion?.key ? onEditQuestion : undefined}
              onSaveSkill={onSaveSkill}
            />
          ) : (
            <ReplyTurn
              key={message.key}
              message={message}
              onRetry={() => onRetry(message.key)}
              pending={pending}
              onOpenProposal={onOpenProposal}
              onDismissProposal={onDismissProposal}
              onDismissProposals={onDismissProposals}
              onCreateProposals={onCreateProposals}
              onActionChange={onActionChange}
              // Gợi ý chỉ dưới tin cuối và khi không có lượt nào đang chạy
              followUps={
                onFollowUp && !pending && index === thread.length - 1
                  ? followUpSuggestions(questionMessageBefore(thread, message.key), message)
                  : undefined
              }
              onFollowUp={onFollowUp}
              // Tin lỗi đã có "Thử lại" trong khung lỗi
              onRegenerate={replaceable && message.key === lastReply?.key && message.status !== "error" ? onRegenerate : undefined}
            />
          ),
        )}
      </div>
      {/* Nút dính đáy vùng cuộn; khối cao 0 nên không chiếm chỗ dưới tin cuối */}
      {awayFromBottom ? (
        <div className="pointer-events-none sticky bottom-3 flex h-0 justify-center">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={scrollToBottom}
            aria-label="Cuộn xuống tin mới nhất"
            title="Cuộn xuống tin mới nhất"
            className={cn("pointer-events-auto -translate-y-full rounded-full bg-background shadow-sm", ENTER_MOTION)}
          >
            <ArrowDown />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Tin người dùng: bong bóng xám căn phải, tối đa 80% cột. Câu hỏi cuối có nút sửa (hiện khi rê chuột, luôn hiện trên
 * điện thoại) như ChatGPT và Claude: sửa ngay tại chỗ trong ô rộng hết cột, con trỏ đặt cuối câu, Enter gửi (thay câu trả
 * lời cũ), Esc hủy. Bộ đếm ký tự chỉ hiện khi gần hết chỗ, như ô soạn; chưa đổi gì thì chưa gửi được.
 */
function UserTurn({
  message,
  onEdit,
  onSaveSkill,
}: {
  message: ThreadMessage;
  onEdit?: (text: string) => void;
  onSaveSkill?: (text: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(message.content);
  const editRef = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const el = editRef.current;
    if (!editing || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);
  const next = text.trim();
  const changed = next.length > 0 && next !== message.content;
  const submit = () => {
    if (!changed || !onEdit) return;
    setEditing(false);
    onEdit(next);
  };
  return (
    <div className={cn("group/question flex flex-col items-end gap-1.5", ENTER_MOTION)}>
      {/* Tệp gửi kèm hiện trên câu hỏi như panel Agent tạo nhiệm vụ: bản trong phiên (có ảnh xem trước sẵn), mở lại cuộc
          thì bản đã lưu ở máy chủ */}
      {message.attachments?.length
        ? message.attachments.map((attachment) => <AttachmentCard key={attachment.id} attachment={attachment} />)
        : message.storedAttachments?.map((attachment) => <StoredAttachmentCard key={attachment.id} attachment={attachment} />)}
      {editing && onEdit ? (
        <div className="flex w-full flex-col gap-1 rounded-2xl bg-muted p-2">
          <Textarea
            ref={editRef}
            compact
            autoResize
            rows={1}
            value={text}
            maxLength={ASSISTANT_MESSAGE_MAX}
            countOnlyNearLimit
            aria-label="Sửa câu hỏi"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (isSendKey(event.nativeEvent)) {
                event.preventDefault();
                submit();
              } else if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                // Esc chỉ hủy sửa, không dừng lượt hay đóng khung
                event.preventDefault();
                event.stopPropagation();
                setEditing(false);
              }
            }}
            className="max-h-60 overflow-y-auto bg-transparent px-1.5 hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none"
          />
          {/* Gửi lại thay cặp hỏi–đáp cũ (không giữ nhánh như ChatGPT): nói trước để người dùng không bất ngờ */}
          <div className="flex min-w-0 items-center gap-2 pl-1.5">
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Gửi sẽ thay câu trả lời bên dưới</p>
            <Button variant="ghost" size="pill-xs" className="shrink-0" onClick={() => setEditing(false)}>
              Hủy
            </Button>
            <Button size="pill-xs" className="shrink-0" onClick={submit} disabled={!changed}>
              Gửi
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="max-w-[80%] break-words whitespace-pre-wrap rounded-2xl bg-muted px-3.5 py-2 text-compact text-foreground">{message.content}</p>
          {onEdit || onSaveSkill ? (
            <div className="flex opacity-0 transition-opacity duration-150 group-focus-within/question:opacity-100 group-hover/question:opacity-100 max-md:opacity-100 motion-reduce:transition-none">
              {onSaveSkill ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Lưu thành kỹ năng"
                  title="Lưu thành kỹ năng"
                  onClick={() => onSaveSkill(message.content)}
                  className="rounded-full max-md:size-11"
                >
                  <BookmarkPlus />
                </Button>
              ) : null}
              {onEdit ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Sửa câu hỏi"
                  title="Sửa câu hỏi"
                  onClick={() => {
                    setText(message.content);
                    setEditing(true);
                  }}
                  className="-mr-1.5 rounded-full max-md:size-11"
                >
                  <Pencil />
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Công cụ soạn (không đọc thêm dữ liệu để trả lời): đề xuất nhiệm vụ và thẻ hành động (ADR-012). */
const COMPOSE_TOOLS: ReadonlySet<string> = new Set(["propose_task", "propose_comment", "propose_status_change", "propose_reminder", "remember", "propose_minutes"]);

/**
 * Lượt chỉ soạn (có thể kèm đọc tệp gửi kèm) thì ghi "soạn đề xuất" (chỉ đề xuất nhiệm vụ) hoặc "soạn thẻ" (có thẻ hành
 * động) thay cho "đọc dữ liệu"; null khi lượt có đọc dữ liệu.
 */
function composeNoun(message: ThreadMessage): "đề xuất" | "thẻ" | null {
  const work = message.steps.filter((step) => step.tool !== "attachment");
  if (work.length === 0 || !work.every((step) => COMPOSE_TOOLS.has(step.tool))) return null;
  return work.every((step) => step.tool === "propose_task") ? "đề xuất" : "thẻ";
}

function workLabel(message: ThreadMessage): string {
  const seconds = message.durationMs === null ? null : Math.max(1, Math.round(message.durationMs / 1000));
  if (message.steps.length > 0) {
    const noun = composeNoun(message);
    const done = noun ? `Đã soạn ${noun}` : "Đã đọc dữ liệu";
    return seconds === null ? done : `${done} trong ${formatDurationVi(seconds)}`;
  }
  return seconds === null ? "Đã suy nghĩ" : `Đã suy nghĩ trong ${formatDurationVi(seconds)}`;
}

/** Tin Trợ lý: chữ toàn chiều rộng cột, không bong bóng. Nút sao chép hiện khi rê chuột hoặc có tiêu điểm (luôn hiện trên điện thoại). */
function ReplyTurn({
  message,
  onRetry,
  pending,
  onOpenProposal,
  onDismissProposal,
  onDismissProposals,
  onCreateProposals,
  followUps,
  onFollowUp,
  onRegenerate,
  onActionChange,
}: {
  message: ThreadMessage;
  onRetry: () => void;
  pending: boolean;
  onActionChange?: (action: AssistantActionDTO) => void;
  onOpenProposal?: (target: ProposalTarget) => void;
  onDismissProposal?: (replyKey: string, index: number, dismissed: boolean) => void;
  onDismissProposals?: (replyKey: string, indexes: number[], dismissed: boolean) => void;
  onCreateProposals?: (items: ProposalTarget[]) => void;
  followUps?: FollowUpSuggestion[];
  onFollowUp?: (prompt: string) => void;
  onRegenerate?: () => void;
}) {
  const streaming = message.status === "streaming";
  // Chữ hiện dần kể cả khi gateway gửi cả cục; tin mở từ lịch sử hiện ngay
  const reply = useSmoothText(message.content, streaming);
  // Suy nghĩ cũng tới từng khúc lớn: chạy dần như chữ trả lời
  const thinking = useSmoothText(message.thinking, streaming);
  // Xong hẳn: luồng đã đóng và chữ đã hiện hết, lúc đó mới hiện nguồn, trạng thái cuối và nút sao chép (nằm dưới chữ).
  // Nhật ký nằm trên chữ nên hiện ngay khi luồng đóng, để đoạn đã hiện không bị đẩy xuống lúc chữ chạy xong.
  const settled = !streaming && !reply.revealing;
  const stepLabels = message.steps.map((step) => step.label);
  const lastStep = stepLabels[stepLabels.length - 1];
  const showWorkLog = !streaming && (message.durationMs !== null || stepLabels.length > 0 || message.thinking !== "");
  const sources = message.sources.slice(0, MAX_SHOWN_SOURCES);
  // Lượt dài (kế hoạch vài chục đề xuất chạy 3–4 phút): đồng hồ và số đề xuất đã soạn cho biết việc vẫn đang tiến
  const elapsed = useElapsedSeconds(message.startedAt, streaming);
  // Đề xuất đang viết dở cũng đếm: một vòng soạn 8–16 đề xuất chạy cả phút, thẻ chỉ tới khi cả vòng xong
  const draftedCount = streaming ? Math.max(message.proposals?.length ?? 0, message.proposalsStarted ?? 0) : 0;
  const progress = [
    draftedCount > 0 ? `${draftedCount} đề xuất` : null,
    elapsed !== null && elapsed >= SHOW_ELAPSED_AFTER_SECONDS ? formatDurationVi(elapsed) : null,
  ].filter(Boolean);

  return (
    <div className={cn("group/reply flex flex-col gap-3", ENTER_MOTION)} aria-busy={!settled || undefined}>
      {showWorkLog ? (
        <AgentWorkLog
          seconds={Math.max(1, Math.round((message.durationMs ?? 0) / 1000))}
          label={workLabel(message)}
          thinking={message.thinking || undefined}
          steps={stepLabels}
          phoneTouchTarget
        />
      ) : null}

      {streaming && message.content === "" && thinking.text ? (
        // Suy nghĩ tới dần khi chữ trả lời chưa bắt đầu; hết suy nghĩ thì ẩn
        <div className="flex max-h-28 flex-col justify-end overflow-hidden break-words border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground [mask-image:linear-gradient(to_bottom,transparent,black_2.5rem)]">
          <p className="whitespace-pre-wrap">{thinking.text}</p>
        </div>
      ) : null}

      {reply.text ? <AgentReplyText text={reply.text} sources={message.sources} /> : null}

      {streaming ? (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-baseline gap-2 text-compact">
            <span className="animate-text-shimmer">
              {stepLabels.length === 0 ? "Đang suy nghĩ…" : composeNoun(message) ? `Đang soạn ${composeNoun(message)}…` : "Đang đọc dữ liệu…"}
            </span>
            {progress.length > 0 ? (
              <span data-slot="assistant-run-progress" className="text-xs text-muted-foreground tabular-nums">
                {progress.join(" · ")}
              </span>
            ) : null}
          </p>
          {lastStep ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate" title={lastStep}>
                {lastStep}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Thẻ đề xuất hiện cùng nguồn, sau khi chữ chạy xong, để câu dẫn của Trợ lý đứng trước thẻ */}
      {settled && message.proposals && message.proposals.length >= PROPOSAL_LIST_MIN ? (
        <ReplyProposalList
          message={message}
          onOpenProposal={onOpenProposal}
          onDismissProposal={onDismissProposal}
          onDismissProposals={onDismissProposals}
          onCreateProposals={onCreateProposals}
        />
      ) : settled && message.proposals?.length ? (
        <div className="flex flex-col gap-2">
          {message.proposals.map((proposal, index) => (
            <AssistantTaskProposalCard
              key={index}
              proposal={proposal}
              created={message.proposalTasks?.[index] ?? null}
              dismissed={message.dismissedProposals?.includes(index) ?? false}
              onOpen={onOpenProposal ? () => onOpenProposal({ replyKey: message.key, index, proposal }) : undefined}
              onDismissedChange={onDismissProposal ? (dismissed) => onDismissProposal(message.key, index, dismissed) : undefined}
            />
          ))}
        </div>
      ) : null}

      {settled && message.actions?.length ? (
        <div className="flex flex-col gap-2">
          {message.actions.map((action) => (
            <AssistantActionCard key={action.id} action={action} onChange={onActionChange} />
          ))}
        </div>
      ) : null}

      {settled && sources.length > 0 ? <SourcesList sources={sources} /> : null}

      {settled && message.status === "aborted" ? <p className="text-xs font-medium text-muted-foreground">Đã dừng</p> : null}

      {settled && message.status === "error" ? (
        <InlineAlert
          variant="error"
          className="max-md:[&_button]:min-h-11 max-md:[&_button]:min-w-11"
          actionLabel={pending ? undefined : "Thử lại"}
          onAction={onRetry}
        >
          {message.errorMessage ?? ASSISTANT_NO_ANSWER_MESSAGE}
        </InlineAlert>
      ) : null}

      {settled && followUps?.length && onFollowUp ? (
        <div className="flex flex-wrap gap-2" aria-label="Gợi ý tiếp theo" role="group">
          {followUps.map((item) => (
            <Button key={item.prompt} variant="toolbar" size="pill" onClick={() => onFollowUp(item.prompt)} className="max-md:h-11">
              {item.label}
            </Button>
          ))}
        </div>
      ) : null}

      {settled && message.content ? (
        <div className="flex items-center opacity-0 transition-opacity duration-150 group-focus-within/reply:opacity-100 group-hover/reply:opacity-100 max-md:opacity-100 motion-reduce:transition-none">
          <CopyMessageButton text={agentReplyToPlainText(message.content)} phoneTouchTarget />
          {onRegenerate ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Tạo lại câu trả lời"
              title="Tạo lại"
              onClick={onRegenerate}
              className="rounded-full max-md:size-11"
            >
              <RotateCcw />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Thẻ danh sách của tin có nhiều đề xuất; "Tạo tất cả" và "Bỏ qua" chỉ tác động các đề xuất còn chờ, "Hoàn tác" các đề xuất đã bỏ qua. */
function ReplyProposalList({
  message,
  onOpenProposal,
  onDismissProposal,
  onDismissProposals,
  onCreateProposals,
}: {
  message: ThreadMessage;
  onOpenProposal?: (target: ProposalTarget) => void;
  onDismissProposal?: (replyKey: string, index: number, dismissed: boolean) => void;
  onDismissProposals?: (replyKey: string, indexes: number[], dismissed: boolean) => void;
  onCreateProposals?: (items: ProposalTarget[]) => void;
}) {
  const items = (message.proposals ?? []).map((proposal, index) => ({
    replyKey: message.key,
    index,
    proposal,
    created: message.proposalTasks?.[index] ?? null,
    dismissed: message.dismissedProposals?.includes(index) ?? false,
  }));
  const waiting = items.filter((item) => !item.created && !item.dismissed);
  const dismissedItems = items.filter((item) => item.dismissed && !item.created);
  // Cả nhóm một request (lưu một lần ở máy chủ); nơi dùng chưa có thì gọi từng thẻ
  const dismissMany =
    onDismissProposals ??
    (onDismissProposal
      ? (replyKey: string, indexes: number[], dismissed: boolean) => indexes.forEach((index) => onDismissProposal(replyKey, index, dismissed))
      : undefined);
  return (
    <AssistantProposalList
      items={items}
      onOpen={onOpenProposal ? (index) => onOpenProposal(items[index]) : undefined}
      onCreateAll={onCreateProposals ? () => onCreateProposals(waiting) : undefined}
      onDismissAll={dismissMany ? () => dismissMany(message.key, waiting.map((item) => item.index), true) : undefined}
      onRestoreAll={dismissMany ? () => dismissMany(message.key, dismissedItems.map((item) => item.index), false) : undefined}
    />
  );
}

function SourcesList({ sources }: { sources: AssistantSourceRef[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">Nguồn</p>
      <ul className="flex flex-col gap-0.5">
        {sources.map((source) => (
          <li key={`${source.type}:${source.id}`} className="min-w-0">
            <Link
              href={source.href}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-sm text-xs text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground",
                focusRingClass,
              )}
            >
              {source.code ? <span className="shrink-0 font-medium tabular-nums">{source.code}</span> : null}
              <span className="min-w-0 truncate">{source.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
