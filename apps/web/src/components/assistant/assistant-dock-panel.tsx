"use client";

import * as React from "react";
import { Ellipsis, Maximize2, Minus, Trash2, X } from "lucide-react";
import { AgentEmptyPattern } from "@/components/agent-chat/agent-chat-parts";
import { AssistantComposer } from "@/components/assistant/assistant-composer";
import type { ChatAttachment } from "@/components/agent-chat/agent-attachments";
import { AssistantThread, type ProposalTarget } from "@/components/assistant/assistant-thread";
import type { DetailStatus } from "@/components/assistant/use-assistant-chat";
import type { ThreadMessage } from "@/components/assistant/assistant-model";
import type { AssistantSourceRef } from "@qcet/contracts/assistant";
import { IconSidebarCompose } from "@/components/layout/sidebar-rounded-icons";
import { Button } from "@/components/ui/button";
import { MenuActionItem, MenuContent, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Khung chat nổi như khung Agent của Linear (người dùng gửi ảnh 17/10/2026): 400 × 600px, nổi trên trang ở góc phải,
 * đáy ngang đáy khung trang, ngay trên thanh dưới. Góc bo 24px đồng tâm với ô soạn bên trong (16px + lề 8px). Viền 8%
 * và bóng đổ vừa để tách khỏi trang mà không nặng. Lớp `z-30` như popover/menu của app: chúng gắn cuối `body` nên vẫn
 * nổi trên khung (menu "…", lịch sử ở thanh dưới), hộp thoại `z-50` cũng vậy.
 */
const PANEL_CLASS =
  "fixed bottom-9 right-4 z-30 flex h-150 max-md:hidden max-h-[calc(100dvh-4rem)] w-100 flex-col overflow-hidden rounded-[calc(var(--radius-xl)+0.5rem)] bg-popover " +
  "shadow-[0_0_0_1px_rgb(26_29_35/0.08),0_16px_40px_-12px_rgb(26_29_35/0.22),0_4px_12px_-4px_rgb(26_29_35/0.08)] " +
  "animate-in fade-in-0 slide-in-from-bottom-2 duration-[var(--motion-duration-normal)] ease-[var(--motion-ease-enter)]";

export interface AssistantDockPanelProps {
  /** Tên cuộc đang mở; chưa có là cuộc mới. */
  title: string | null;
  /** Mã cuộc đang mở: có thì hiện menu "…" có mục Xóa. */
  conversationId: string | null;
  thread: ThreadMessage[];
  detailStatus: DetailStatus;
  detailError: string | null;
  context: AssistantSourceRef | null;
  pending: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onRetry: (replyKey: string) => void;
  /** Mở hộp tạo nhiệm vụ đã điền theo thẻ đề xuất (ADR-010). */
  onOpenProposal: (target: ProposalTarget) => void;
  onDismissProposal: (replyKey: string, index: number, dismissed: boolean) => void;
  onStop: () => void;
  sendError: string | null;
  /** Ảnh/tệp chờ gửi ở ô soạn (giữ trong `useAssistantChat` của `AssistantDock`). */
  attachments: ChatAttachment[];
  onAddAttachments: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onNewChat: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  onClose: () => void;
  onDeleteRequest: () => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  onThreadScroll: () => void;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * Nội dung khung chat nổi: thanh đầu (tên cuộc, "…", thu nhỏ, mở toàn trang, đóng), luồng tin hoặc màn chào khi chưa
 * có tin, ô soạn ở đáy. Trạng thái chat nằm ở `AssistantDock` để thu nhỏ hay chuyển trang không mất lượt đang chạy.
 */
export function AssistantDockPanel({
  title,
  conversationId,
  thread,
  detailStatus,
  detailError,
  context,
  pending,
  draft,
  onDraftChange,
  onSubmit,
  onRetry,
  onOpenProposal,
  onDismissProposal,
  onStop,
  sendError,
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  onNewChat,
  onMinimize,
  onExpand,
  onClose,
  onDeleteRequest,
  listRef,
  onThreadScroll,
  composerRef,
}: AssistantDockPanelProps) {
  const panelRef = React.useRef<HTMLElement>(null);
  const emptyRef = React.useRef<HTMLDivElement>(null);
  const start = thread.length === 0 && (detailStatus === "idle" || detailStatus === "ready");

  return (
    <section
      ref={panelRef}
      aria-label="Trợ lý"
      data-slot="assistant-dock-panel"
      className={PANEL_CLASS}
      onKeyDown={(event) => {
        // Esc thu nhỏ khung khi tiêu điểm trong khung. Menu, hộp thoại nằm trong portal (sự kiện React vẫn nổi lên đây)
        // thì Esc thuộc về chúng; đang trả lời thì Esc của ô soạn dừng lượt trước
        if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing || pending) return;
        if (!(event.target instanceof Node) || !panelRef.current?.contains(event.target)) return;
        event.preventDefault();
        onMinimize();
      }}
    >
      {/* Như trang Trợ lý: trình đọc màn hình biết lượt bắt đầu và xong */}
      <div role="status" aria-live="polite" className="sr-only">
        {pending ? "Trợ lý đang trả lời." : ""}
      </div>

      <div className="flex h-12 shrink-0 items-center gap-1 pl-4 pr-2">
        <h2 className="min-w-0 truncate text-compact font-medium text-foreground">{title ?? "Cuộc trò chuyện mới"}</h2>
        {conversationId ? (
          <MenuRoot modal={false}>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Thao tác với cuộc trò chuyện">
                <Ellipsis />
              </Button>
            </MenuTrigger>
            <MenuContent align="start" className="w-56 min-w-0">
              <MenuActionItem leading={<IconSidebarCompose className="size-3.5" />} onClick={onNewChat}>
                Cuộc trò chuyện mới
              </MenuActionItem>
              <MenuActionItem leading={<Maximize2 />} onClick={onExpand} disabled={pending}>
                Mở trong trang Trợ lý
              </MenuActionItem>
              <MenuSeparator className="my-1 border-t border-border/40" />
              <MenuActionItem leading={<Trash2 />} destructive onClick={onDeleteRequest} disabled={pending}>
                Xóa
              </MenuActionItem>
            </MenuContent>
          </MenuRoot>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <HeaderButton label="Thu nhỏ" onClick={onMinimize}>
            <Minus />
          </HeaderButton>
          {/* Đang trả lời thì chưa mở toàn trang: trang đọc lại cuộc từ máy chủ, câu trả lời dở chưa được lưu */}
          <HeaderButton label={pending ? "Chờ Trợ lý trả lời xong để mở toàn trang" : "Mở trong trang Trợ lý"} onClick={onExpand} disabled={pending}>
            <Maximize2 />
          </HeaderButton>
          <HeaderButton label="Đóng" onClick={onClose}>
            <X />
          </HeaderButton>
        </div>
      </div>

      {start ? (
        // Màn trống chỉ còn lưới icon mờ, canh giữa vùng trống (người dùng bỏ tên, câu giới thiệu, chip gợi ý và câu chỉ
        // đọc cho gọn, 17/10/2026; câu chỉ đọc theo ADR-009 vẫn ở chân trang Trợ lý). Icon đậm giữ chỗ thấp như cũ (đệm
        // 240px + ô 24px), lưới tỏa cả xuống dưới icon (19/10/2026), mờ ở mép trên và mép sát ô soạn.
        <div
          ref={emptyRef}
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 [mask-image:linear-gradient(transparent,#000_1.5rem,#000_calc(100%-1.5rem),transparent)]"
        >
          <div className="flex-1" />
          <div aria-hidden="true" className="h-60 shrink" />
          <div className="relative h-6 shrink-0">
            <AgentEmptyPattern trackRef={emptyRef} />
          </div>
          <div className="flex-1" />
        </div>
      ) : (
        <AssistantThread
          compact
          thread={thread}
          detailStatus={detailStatus}
          detailError={detailError}
          onRetry={onRetry}
          onOpenProposal={onOpenProposal}
          onDismissProposal={onDismissProposal}
          onNewChat={onNewChat}
          listRef={listRef}
          onScroll={onThreadScroll}
          context={context}
          pending={pending}
        />
      )}

      <div className="shrink-0 p-2">
        <AssistantComposer
          variant="dock"
          value={draft}
          onChange={onDraftChange}
          onSubmit={onSubmit}
          onStop={onStop}
          pending={pending}
          disabled={detailStatus === "loading" || detailStatus === "error"}
          context={null}
          error={sendError}
          inputRef={composerRef}
          stopScope={panelRef}
          attachments={attachments}
          onAddAttachments={onAddAttachments}
          onRemoveAttachment={onRemoveAttachment}
        />
      </div>
    </section>
  );
}

function HeaderButton({ label, onClick, disabled = false, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Nút bị khóa không nhận chuột: bọc span để tooltip vẫn giải thích vì sao */}
        <span className={cn(disabled && "cursor-not-allowed")}>
          <Button variant="ghost" size="icon-xs" onClick={onClick} disabled={disabled} aria-label={label}>
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
