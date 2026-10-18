"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { AssistantConversationSummaryDTO } from "@/contracts/assistant";
import { formatConversationTime, groupConversationsByRecency } from "@/domain/assistant/assistant-history";
import { ConversationRowsSkeleton } from "@/components/assistant/conversation-rows-skeleton";
import type { useAssistantHistory } from "@/components/assistant/use-assistant-history";
import { Button } from "@/components/ui/button";
import { MenuContent, MenuGroup, MenuGroupLabel, MenuLinkItem, MenuOptionItem, MenuRoot, MenuTrigger } from "@/components/ui/menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type AssistantHistoryState = ReturnType<typeof useAssistantHistory>;

const CONTEXT_GROUP_LABEL = "Về mục này";
/**
 * Hàng 32px chữ 13px như menu lịch sử ở thanh dưới (cùng một danh sách); tên thụt vào 36px so với nhãn nhóm như menu
 * lịch sử của Linear.
 */
const ROW_CLASS = "h-8 gap-3 pl-9 pr-3 text-compact";

export interface AssistantHistoryMenuProps {
  /** Chữ trên nút: tên cuộc đang mở, chưa có là "Cuộc trò chuyện mới". */
  title: string;
  history: AssistantHistoryState;
  activeId: string | null;
}

/**
 * Lịch sử trò chuyện là menu thả xuống từ tên cuộc ở thanh đầu, như Linear Agent (người dùng yêu cầu và gửi ảnh Linear
 * 17/10/2026, thay panel trái kiểu ChatGPT): nhóm "Về mục này" khi mở từ nhiệm vụ/văn bản, các nhóm theo ngày (không có
 * mục cuộc mới: nút soạn mới cạnh tên cuộc đã làm việc đó, người dùng bỏ 17/10/2026); mỗi hàng là tên, chữ "Hiện tại" ở cuộc đang mở (chỉ thêm chữ, không tô nền) và
 * giờ. Điện thoại là bottom sheet. Đổi tên, xóa cuộc đang mở ở menu "…" của thanh đầu.
 */
export function AssistantHistoryMenu({ title, history, activeId }: AssistantHistoryMenuProps) {
  const { refresh } = history;
  const popupRef = React.useRef<HTMLDivElement>(null);
  return (
    // Không khóa cuộn trang như menu "…" của thanh đầu; mở menu thì làm mới lặng lẽ (tab khác có thể đã thêm cuộc)
    <MenuRoot modal={false} onOpenChange={(open) => open && void refresh()}>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="min-w-0 max-w-full gap-1 px-2 text-compact font-medium text-foreground data-[popup-open]:bg-accent max-md:h-11"
        >
          {/* Tên nút cho trình đọc màn hình nói rõ là mở lịch sử, không chỉ đọc tên cuộc */}
          <span className="sr-only">Lịch sử trò chuyện: </span>
          <span className="truncate">{title}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </MenuTrigger>
      <MenuContent
        ref={popupRef}
        align="start"
        sideOffset={4}
        className="w-96 min-w-0 max-h-[min(30rem,var(--available-height))] overflow-y-auto overscroll-contain"
        mobileSheet
        sheetTitle="Lịch sử trò chuyện"
      >
        <HistoryMenuItems history={history} activeId={activeId} popupRef={popupRef} />
      </MenuContent>
    </MenuRoot>
  );
}

function HistoryMenuItems({
  history,
  activeId,
  popupRef,
}: Omit<AssistantHistoryMenuProps, "title"> & { popupRef: React.RefObject<HTMLDivElement | null> }) {
  const now = new Date();
  const contextIds = new Set(history.contextItems.map((item) => item.id));
  const groups = [
    ...(history.contextItems.length > 0 ? [{ key: "context", label: CONTEXT_GROUP_LABEL, items: history.contextItems }] : []),
    ...groupConversationsByRecency(
      history.items.filter((item) => !contextIds.has(item.id)),
      now,
    ),
  ];
  const loading = history.status === "loading" && history.items.length === 0;
  const empty = history.status === "ready" && groups.length === 0;

  // "Thử lại", "Tải thêm" tự mất khi tải xong; tiêu điểm đang ở đó thì rơi xuống body. Đưa về khung menu để mũi tên,
  // Esc vẫn chạy (chỉ khi menu đang mở)
  React.useEffect(() => {
    const popup = popupRef.current;
    if (popup?.hasAttribute("data-open") && (document.activeElement === document.body || document.activeElement === null)) {
      popup.focus({ preventScroll: true });
    }
  }, [history.hasMore, history.status, popupRef]);

  return (
    <>
      {/* Điện thoại: hàng của bottom sheet cao 40px, lề 12px (SHEET_POPUP_CLASS) nên skeleton theo cùng cỡ */}
      {loading ? <ConversationRowsSkeleton count={3} withTime rowClassName="h-8 pl-9 pr-3 max-md:h-10 max-md:px-3" /> : null}

      {history.error ? (
        <div className="flex items-center justify-between gap-2 py-1 pl-3 pr-1 text-xs text-muted-foreground">
          {/* Menu chỉ đọc mục menuitem: lỗi phải tự báo cho trình đọc màn hình */}
          <span role="alert">{history.error}</span>
          {/* Chỉ lỗi trang đầu có nút thử lại; giữ menu mở để thấy danh sách vừa tải */}
          {history.status === "error" ? (
            <MenuOptionItem onClick={() => void history.retry()} className="w-auto shrink-0 px-2">
              Thử lại
            </MenuOptionItem>
          ) : null}
        </div>
      ) : null}

      {groups.map((group) => (
        <MenuGroup key={group.key}>
          <MenuGroupLabel className="flex h-7 select-none items-center px-3 text-xs text-muted-foreground">{group.label}</MenuGroupLabel>
          {group.items.map((item) => (
            <HistoryMenuRow key={item.id} item={item} current={item.id === activeId} now={now} />
          ))}
        </MenuGroup>
      ))}

      {empty ? <p className="px-3 py-2 text-xs text-muted-foreground">Chưa có cuộc trò chuyện nào.</p> : null}
      {history.moreError ? (
        <p role="alert" className="px-3 py-1 text-xs text-destructive">
          {history.moreError}
        </p>
      ) : null}
      {history.hasMore ? (
        <MenuOptionItem onClick={() => void history.loadMore()} disabled={history.loadingMore} className={`${ROW_CLASS} text-muted-foreground`}>
          {history.loadingMore ? "Đang tải…" : "Tải thêm"}
        </MenuOptionItem>
      ) : null}
    </>
  );
}

/** Một cuộc: tên cắt cuối kèm tooltip khi bị cắt (như cuộc gần đây ở màn đầu), "Hiện tại" và giờ bên phải. */
function HistoryMenuRow({ item, current, now }: { item: AssistantConversationSummaryDTO; current: boolean; now: Date }) {
  const time = formatConversationTime(item.lastMessageAt, now);
  const titleRef = React.useRef<HTMLSpanElement>(null);
  const [titleCut, setTitleCut] = React.useState(false);
  const measure = () => {
    const el = titleRef.current;
    if (el) setTitleCut(el.scrollWidth > el.clientWidth);
  };
  return (
    <MenuLinkItem
      render={<Link href={`/assistant/${encodeURIComponent(item.id)}`} />}
      aria-current={current ? "page" : undefined}
      label={item.title}
      className={ROW_CLASS}
      hint={
        <span className="flex items-center gap-3">
          {current ? <span>Hiện tại</span> : null}
          <span title={time.full}>{time.short}</span>
        </span>
      }
    >
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Đo ở chính span (trigger của tooltip): sự kiện chuột gắn trên hàng menu không tới được trình xử lý */}
          <span ref={titleRef} onPointerEnter={measure} className="block truncate">
            {item.title}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" hidden={!titleCut}>
          {item.title}
        </TooltipContent>
      </Tooltip>
    </MenuLinkItem>
  );
}
