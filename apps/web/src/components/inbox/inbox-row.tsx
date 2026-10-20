"use client";

import * as React from "react";
import Image from "next/image";
import { Archive, ArchiveRestore, Mail, MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { EmptyGlyphName, IllustrationName } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { getTypeBadge } from "@qcet/shared/lib/notification-triage";
import {
  formatNotificationAbsoluteTime,
  formatNotificationTime,
  getNotificationDisplayTitle,
  getNotificationEventLabel,
  type NotificationGroup,
} from "@/lib/notification-inbox";

/** Đọc envelope API; lỗi HTTP hoặc `success: false` đều ném lỗi. */
export async function readNotificationEnvelope(res: Response): Promise<any> {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    const message = typeof json?.error === "string" ? json.error : json?.error?.message;
    throw new Error(message || `HTTP ${res.status}`);
  }
  return json;
}

/** Mốc "bây giờ" làm mới theo chu kỳ để thời gian tương đối ("5 phút") tự cập nhật. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function toNotificationIso(value: string | Date | undefined): string | undefined {
  if (!value) return undefined;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export interface InboxEmptyCopy {
  illustration: IllustrationName;
  title: string;
  description: string;
  action?: "retry" | "clear" | "show-all";
}

/** Hộp thư không có dòng nào: nói rõ vì sao (lỗi tải, lọc không ra, đã đọc hết, chưa có thông báo) và việc làm tiếp. */
export function getInboxEmptyCopy({
  failed,
  hasCondition,
  unreadOnly,
  archived = false,
}: {
  failed: boolean;
  hasCondition: boolean;
  unreadOnly: boolean;
  /** Đang xem bộ lọc "Đã lưu trữ". */
  archived?: boolean;
}): InboxEmptyCopy {
  if (failed) {
    return { illustration: "load-error", title: "Không tải được hộp thư", description: "Có lỗi khi tải thông báo. Thử lại sau ít phút.", action: "retry" };
  }
  if (hasCondition) {
    return { illustration: "no-results", title: "Không có thông báo phù hợp", description: "Thử từ khóa khác hoặc bỏ bớt bộ lọc.", action: "clear" };
  }
  if (archived) {
    return { illustration: "inbox", title: "Chưa lưu trữ thông báo nào", description: "Lưu trữ thông báo đã xử lý (phím E) để Hộp thư gọn hơn; chúng vẫn xem lại được ở đây.", action: "show-all" };
  }
  if (unreadOnly) {
    return { illustration: "all-done", title: "Đã đọc hết", description: "Không còn thông báo nào chưa đọc.", action: "show-all" };
  }
  return { illustration: "inbox", title: "Không có thông báo", description: "Thông báo gửi tới Thầy/Cô sẽ hiện ở đây." };
}

/**
 * Icon lớn cho Hộp thư trống (thay tranh vẽ tay từ 20/10/2026, theo trang trống Hộp thư của Linear): theo khóa tranh của nội dung
 * ở trên, riêng bộ lọc "Đã lưu trữ" dùng hộp lưu trữ.
 */
export function getInboxEmptyGlyph(copy: InboxEmptyCopy, archived: boolean): EmptyGlyphName {
  switch (copy.illustration) {
    case "load-error":
    case "no-results":
    case "all-done":
      return copy.illustration;
    default:
      return archived ? "archive" : "inbox";
  }
}

/** Hàng thông báo hai dòng của Hộp thư (trang /inbox và khung nổi cạnh thanh bên). */
export function InboxRow({
  group,
  now,
  selected,
  tabIndex,
  snippet,
  actions,
  onOpen,
  onFocus,
  onKeyDown,
}: {
  group: NotificationGroup;
  now: Date;
  selected: boolean;
  tabIndex: number;
  /** Lời nhắn kèm thông báo (bình luận, lý do), hiện thành dòng thứ ba như hàng Inbox của Notion. */
  snippet?: string;
  /** Nút thao tác nhanh (đã đọc, lưu trữ): hiện khi rê chuột hoặc hàng đang được chọn bằng phím, thế chỗ giờ như Linear. */
  actions?: React.ReactNode;
  onOpen: () => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const n = group.latest;
  const unread = group.unreadIds.length > 0;
  const title = getNotificationDisplayTitle(n);
  const event = getNotificationEventLabel(n.type);
  const isWelcome = n.type === "welcome";
  // Thông báo không có người gửi (hệ thống, lời chào): dòng phụ là đoạn đầu nội dung như Linear, không lặp nhãn sự kiện
  const excerpt = !n.hasActor ? (n.body ?? "").trim().split(/\r?\n/)[0] : "";
  const secondary =
    excerpt ||
    [event, n.hasActor ? n.actorName : null, group.items.length > 1 ? `${group.items.length} cập nhật` : null]
      .filter(Boolean)
      .join(" · ");
  const absolute = formatNotificationAbsoluteTime(n.createdAt);
  const TypeIcon = getTypeBadge(n.type).icon;

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-label={[unread ? "Chưa đọc" : null, title, secondary, snippet, absolute].filter(Boolean).join(". ")}
      tabIndex={tabIndex}
      data-group-key={group.key}
      onClick={onOpen}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={cn(
        // Hàng hai dòng 58px như Linear Inbox (cao gấp ~2,07 hàng sidebar 28px, đo ảnh 14/10/2026): avatar 32px, tiêu đề 13px, dòng phụ 12px kèm thời gian bên phải
        // Viền focus vẽ vào trong: khung nổi bọc hàng trong lớp overflow-hidden (hiệu ứng thu gọn khi lưu trữ) nên viền ngoài bị cắt góc
        "group/row relative flex cursor-pointer gap-3 rounded-lg py-3 pl-3 pr-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        // Có dòng trích lời nhắn thì avatar canh dòng đầu như Notion
        snippet ? "items-start" : "items-center",
        selected ? "bg-selected" : "hover:bg-accent/60"
      )}
    >
      {n.hasActor ? (
        <UserAvatar name={n.actorName} size="lg" />
      ) : isWelcome ? (
        <Image src="/logo-qcet.png" alt="" aria-hidden width={32} height={32} className="size-8 shrink-0 rounded-full object-contain" />
      ) : (
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
        >
          <TypeIcon size={16} />
        </span>
      )}
      <div className={cn("min-w-0 flex-1", actions && "group-hover/row:pr-14 group-focus-visible/row:pr-14")}>
        {/* Tên thư luôn đậm vừa và màu chữ chính (người dùng chốt 14/10/2026); chưa đọc = chấm màu chính ngay trước tên, như Linear.
            Chấm luôn được render để khi mở thư (đã đọc) nó thu nhỏ, mờ dần và tên trượt về trái thay vì biến mất đột ngột. */}
        <p className="flex items-center text-compact font-medium text-foreground">
          <span
            aria-hidden
            className={cn(
              "h-2 w-2 shrink-0 rounded-full bg-primary transition-[width,margin,opacity,scale] duration-[var(--motion-duration-panel)] ease-[var(--motion-ease-standard)] motion-reduce:transition-none",
              unread ? "mr-1.5" : "mr-0 w-0 scale-0 opacity-0"
            )}
          />
          <span className="truncate">{title}</span>
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{secondary}</span>
          <time
            dateTime={toNotificationIso(n.createdAt)}
            title={absolute}
            className={cn("shrink-0 tabular-nums", actions && "group-hover/row:invisible group-focus-visible/row:invisible")}
          >
            {formatNotificationTime(n.createdAt, now)}
          </time>
        </div>
        {snippet ? <p className="mt-0.5 line-clamp-2 text-xs text-foreground/80">{snippet}</p> : null}
      </div>
      {actions ? (
        // Nút ở góc phải, chữ chừa chỗ (pr-14) và giờ ẩn đi khi nút hiện; không nhận Tab (đã có phím E/U)
        <div
          className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover/row:flex group-focus-visible/row:flex"
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Phím tắt trên hàng đang chọn của Hộp thư (khung nổi và trang /inbox). */
export const INBOX_ARCHIVE_KEY = "e";
export const INBOX_TOGGLE_READ_KEY = "u";
/** Toast lưu trữ có nút Hoàn tác giữ lâu hơn toast thường. */
export const INBOX_UNDO_TOAST_MS = 6000;

/** Hai nút thao tác nhanh của một hàng: đã đọc/chưa đọc (phím U) và lưu trữ/bỏ lưu trữ (phím E). */
export function InboxRowActions({
  unread,
  archived,
  disabled,
  onToggleRead,
  onArchive,
}: {
  unread: boolean;
  archived: boolean;
  disabled?: boolean;
  onToggleRead: () => void;
  onArchive: () => void;
}) {
  return (
    <>
      {/* Thông báo đã lưu trữ luôn là đã đọc: chỉ còn nút đưa về Hộp thư */}
      {archived ? null : (
        <RowAction label={unread ? "Đánh dấu đã đọc" : "Đánh dấu chưa đọc"} shortcut="U" disabled={disabled} onClick={onToggleRead}>
          {unread ? <MailOpen /> : <Mail />}
        </RowAction>
      )}
      <RowAction label={archived ? "Đưa về Hộp thư" : "Lưu trữ"} shortcut="E" disabled={disabled} onClick={onArchive}>
        {archived ? <ArchiveRestore /> : <Archive />}
      </RowAction>
    </>
  );
}

function RowAction({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          tabIndex={-1}
          aria-label={label}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label} <span className="ml-1 text-background/60">{shortcut}</span>
      </TooltipContent>
    </Tooltip>
  );
}
