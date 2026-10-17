"use client";

import * as React from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { AssistantSourceRef, AssistantTaskProposal } from "@/contracts/assistant";
import { agentReplyToPlainText } from "@/domain/tasks/agent-reply-format";
import { AgentReplyText, AgentWorkLog, CopyMessageButton } from "@/components/agent-chat/agent-chat-parts";
import { AttachmentCard } from "@/components/agent-chat/agent-attachments";
import { useSmoothText } from "@/components/agent-chat/use-smooth-text";
import { Button } from "@/components/ui/button";
import { focusRingClass } from "@/components/ui/focus-ring";
import { InlineAlert } from "@/components/ui/inline-alert";
import { cn } from "@/lib/utils";
import { ASSISTANT_NO_ANSWER_MESSAGE, type ThreadMessage } from "@/components/assistant/assistant-model";
import type { DetailStatus } from "@/components/assistant/use-assistant-chat";
import { AssistantTaskProposalCard } from "@/components/assistant/assistant-task-proposal-card";

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
}

export interface ProposalTarget {
  replyKey: string;
  index: number;
  proposal: AssistantTaskProposal;
}

/** Cột tin của cuộc đang mở: cuộn được, căn giữa, rộng tối đa 720px. Màn đầu (chưa có tin) do khung cha lo. */
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
}: AssistantThreadProps) {
  return (
    <div ref={listRef} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-slot="assistant-thread">
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

        {thread.map((message) =>
          message.role === "user" ? (
            <UserTurn key={message.key} message={message} />
          ) : (
            <ReplyTurn
              key={message.key}
              message={message}
              onRetry={() => onRetry(message.key)}
              pending={pending}
              onOpenProposal={onOpenProposal}
            />
          ),
        )}
      </div>
    </div>
  );
}

/** Tin người dùng: bong bóng xám căn phải, tối đa 80% cột. */
function UserTurn({ message }: { message: ThreadMessage }) {
  return (
    <div className={cn("flex flex-col items-end gap-1.5", ENTER_MOTION)}>
      {/* Tệp gửi kèm hiện trên câu hỏi như panel Agent tạo nhiệm vụ; chỉ trong phiên (mở lại thì xem ở nhật ký "Đọc tệp…") */}
      {message.attachments?.map((attachment) => <AttachmentCard key={attachment.id} attachment={attachment} />)}
      <p className="max-w-[80%] break-words whitespace-pre-wrap rounded-2xl bg-muted px-3.5 py-2 text-compact text-foreground">{message.content}</p>
    </div>
  );
}

/** Lượt chỉ soạn đề xuất (có thể kèm đọc tệp gửi kèm) thì ghi "soạn đề xuất" thay cho "đọc dữ liệu". */
function onlyProposes(message: ThreadMessage): boolean {
  const work = message.steps.filter((step) => step.tool !== "attachment");
  return work.length > 0 && work.every((step) => step.tool === "propose_task");
}

function workLabel(message: ThreadMessage): string {
  const seconds = message.durationMs === null ? null : Math.max(1, Math.round(message.durationMs / 1000));
  if (message.steps.length > 0) {
    const done = onlyProposes(message) ? "Đã soạn đề xuất" : "Đã đọc dữ liệu";
    return seconds === null ? done : `${done} trong ${seconds} giây`;
  }
  return seconds === null ? "Đã suy nghĩ" : `Đã suy nghĩ trong ${seconds} giây`;
}

/** Tin Trợ lý: chữ toàn chiều rộng cột, không bong bóng. Nút sao chép hiện khi rê chuột hoặc có tiêu điểm (luôn hiện trên điện thoại). */
function ReplyTurn({
  message,
  onRetry,
  pending,
  onOpenProposal,
}: {
  message: ThreadMessage;
  onRetry: () => void;
  pending: boolean;
  onOpenProposal?: (target: ProposalTarget) => void;
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
          <p className="w-fit animate-text-shimmer text-compact">
            {stepLabels.length === 0 ? "Đang suy nghĩ…" : onlyProposes(message) ? "Đang soạn đề xuất…" : "Đang đọc dữ liệu…"}
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
      {settled && message.proposals?.length ? (
        <div className="flex flex-col gap-2">
          {message.proposals.map((proposal, index) => (
            <AssistantTaskProposalCard
              key={index}
              proposal={proposal}
              created={message.proposalTasks?.[index] ?? null}
              onOpen={onOpenProposal ? () => onOpenProposal({ replyKey: message.key, index, proposal }) : undefined}
            />
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

      {settled && message.content ? (
        <div className="flex items-center opacity-0 transition-opacity duration-150 group-focus-within/reply:opacity-100 group-hover/reply:opacity-100 max-md:opacity-100 motion-reduce:transition-none">
          <CopyMessageButton text={agentReplyToPlainText(message.content)} phoneTouchTarget />
        </div>
      ) : null}
    </div>
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
