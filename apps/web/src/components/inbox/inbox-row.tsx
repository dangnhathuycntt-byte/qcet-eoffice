"use client";

import * as React from "react";
import Image from "next/image";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { IllustrationName } from "@/components/ui/empty-state";
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
}: {
  failed: boolean;
  hasCondition: boolean;
  unreadOnly: boolean;
}): InboxEmptyCopy {
  if (failed) {
    return { illustration: "load-error", title: "Không tải được hộp thư", description: "Có lỗi khi tải thông báo. Thử lại sau ít phút.", action: "retry" };
  }
  if (hasCondition) {
    return { illustration: "no-results", title: "Không có thông báo phù hợp", description: "Thử từ khóa khác hoặc bỏ bớt bộ lọc.", action: "clear" };
  }
  if (unreadOnly) {
    return { illustration: "all-done", title: "Đã đọc hết", description: "Không còn thông báo nào chưa đọc.", action: "show-all" };
  }
  return { illustration: "inbox", title: "Không có thông báo", description: "Thông báo gửi tới Thầy/Cô sẽ hiện ở đây." };
}

/** Hàng thông báo hai dòng của Hộp thư (trang /inbox và khung nổi cạnh thanh bên). */
export function InboxRow({
  group,
  now,
  selected,
  tabIndex,
  snippet,
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
        "relative flex cursor-pointer gap-3 rounded-lg py-3 pl-3 pr-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
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
      <div className="min-w-0 flex-1">
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
          <time dateTime={toNotificationIso(n.createdAt)} title={absolute} className="shrink-0 tabular-nums">
            {formatNotificationTime(n.createdAt, now)}
          </time>
        </div>
        {snippet ? <p className="mt-0.5 line-clamp-2 text-xs text-foreground/80">{snippet}</p> : null}
      </div>
    </div>
  );
}
