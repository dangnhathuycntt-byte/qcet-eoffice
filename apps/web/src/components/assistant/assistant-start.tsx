"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { AssistantConversationSummaryDTO } from "@qcet/contracts/assistant";
import { formatConversationTime } from "@qcet/shared/domain/assistant/assistant-history";
import { ASSISTANT_EXAMPLES, type AssistantExample } from "@/components/assistant/assistant-model";
import { IconSidebarCalendar, IconSidebarInboxIn, IconSidebarTasks, type SidebarIconProps } from "@/components/layout/sidebar-rounded-icons";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { focusRingClass } from "@/components/ui/focus-ring";
import { Pressable } from "@/components/ui/pressable";
import { ConversationRowsSkeleton } from "@/components/assistant/conversation-rows-skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Số cuộc gần đây hiện dưới các thẻ ví dụ ở màn đầu. */
const RECENT_COUNT = 3;
/** Cột màn đầu: rộng như ô soạn (752px, chữ 704px). */
const COLUMN_CLASS = "mx-auto w-full max-w-[752px] px-4 md:px-6";
/** Icon của từng thẻ lấy từ bộ icon sidebar (lưới 16, nét 1,25px), cùng hình với mục điều hướng tương ứng. */
const EXAMPLE_ICONS: Record<AssistantExample["id"], React.ComponentType<SidebarIconProps>> = {
  "create-task": IconSidebarTasks,
  "due-soon": IconSidebarCalendar,
  "pending-documents": IconSidebarInboxIn,
};

/* ---------------------------------------------------------------------------------------------------------------
 * Ẩn thẻ ví dụ: nhớ theo trình duyệt của người xem (bộ nhớ bị chặn thì chỉ ẩn trong phiên này).
 * ------------------------------------------------------------------------------------------------------------- */

const EXAMPLES_STORAGE_KEY = "qcet.assistant.examplesHidden";
const examplesListeners = new Set<() => void>();
let examplesHiddenInSession = false;

function readExamplesHidden(): boolean {
  try {
    return examplesHiddenInSession || window.localStorage.getItem(EXAMPLES_STORAGE_KEY) === "1";
  } catch {
    return examplesHiddenInSession;
  }
}

function hideExamples() {
  examplesHiddenInSession = true;
  try {
    window.localStorage.setItem(EXAMPLES_STORAGE_KEY, "1");
  } catch {
    // Bộ nhớ bị chặn: vẫn ẩn trong phiên này
  }
  examplesListeners.forEach((listener) => listener());
}

function subscribeExamples(listener: () => void) {
  examplesListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    examplesListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export interface AssistantStartListProps {
  /** Các cuộc đã lưu, mới nhất trước; có cuộc thì hiện tối đa ba cuộc thay cho thẻ ví dụ. */
  items: AssistantConversationSummaryDTO[];
  status: "loading" | "ready" | "error";
  now: Date;
  /** Bấm thẻ hỏi: gửi nguyên câu của thẻ. */
  onSuggest: (text: string) => void;
  /** Bấm thẻ "Tạo nhiệm vụ": mở hộp tạo nhiệm vụ của app. */
  onCreateTask: () => void;
  /** Vừa ẩn thẻ ví dụ: nút ẩn biến mất nên khung cha đưa tiêu điểm về ô soạn. */
  onExamplesDismissed?: () => void;
  /** Câu lỗi khi tải lịch sử lỗi (chưa biết là trống hay không): hiện kèm "Thử lại" thay cho thẻ ví dụ. */
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Dưới ô soạn ở màn đầu, như Linear Agent: "Bắt đầu với vài gợi ý" và ba thẻ (icon, tên, một câu mô tả), ẩn được bằng
 * nút X; hoặc tối đa ba cuộc gần đây (chữ thường, giờ bên phải). Gợi ý và lịch sử không hiện cùng lúc (người dùng chốt
 * 17/10/2026): đã có cuộc thì chỉ hiện cuộc gần đây; thẻ ví dụ chỉ hiện khi chưa có cuộc nào (đang tải thì giữ chỗ bằng
 * skeleton, không hiện thẻ rồi đổi sang lịch sử). Điện thoại: thẻ thành hàng ngang icon bên trái.
 */
export function AssistantStartList({ items, status, now, onSuggest, onCreateTask, onExamplesDismissed, error, onRetry }: AssistantStartListProps) {
  const examplesHidden = React.useSyncExternalStore(subscribeExamples, readExamplesHidden, () => false);
  const recent = items.slice(0, RECENT_COUNT);
  // Chỉ khi đã biết là trống: đang tải hay tải lỗi thì chưa biết có lịch sử hay không
  const showExamples = !examplesHidden && recent.length === 0 && status === "ready";

  return (
    <div className={cn(COLUMN_CLASS, "flex flex-col gap-3")}>
      {showExamples ? (
        <section aria-labelledby="assistant-examples-title">
          <div className="flex h-8 items-center justify-between gap-2 pl-4">
            <h2 id="assistant-examples-title" className="text-xs font-normal text-muted-foreground">
              Bắt đầu với vài gợi ý
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Ẩn gợi ý"
                  className="text-muted-foreground max-md:size-11"
                  onClick={() => {
                    hideExamples();
                    onExamplesDismissed?.();
                  }}
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Ẩn gợi ý</TooltipContent>
            </Tooltip>
          </div>
          <ul className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ASSISTANT_EXAMPLES.map((example) => {
              const Icon = EXAMPLE_ICONS[example.id];
              const prompt = example.prompt;
              return (
                <li key={example.id} className="flex">
                  <Pressable
                    onClick={() => (prompt ? onSuggest(prompt) : onCreateTask())}
                    className={cn(
                      "flex w-full flex-col items-start rounded-lg border border-border/70 p-4 text-left transition-colors duration-100 hover:bg-primary/8 active:bg-primary/10",
                      "min-h-32 max-sm:min-h-0 max-sm:flex-row max-sm:items-center max-sm:gap-3 max-sm:px-3 max-sm:py-2.5",
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="mt-auto flex min-w-0 flex-col gap-1 pt-6 max-sm:mt-0 max-sm:pt-0">
                      <span className="text-compact font-medium text-foreground">{example.title}</span>
                      <span className="line-clamp-2 text-pretty text-xs text-muted-foreground">{example.description}</span>
                    </span>
                  </Pressable>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {recent.length > 0 ? (
        <ul className="flex flex-col gap-0.5" aria-label="Cuộc trò chuyện gần đây">
          {recent.map((item) => (
            <RecentRow key={item.id} item={item} now={now} />
          ))}
        </ul>
      ) : status === "loading" ? (
        <ConversationRowsSkeleton count={RECENT_COUNT} withTime className="gap-0.5" rowClassName="h-8 px-4 max-md:h-11" />
      ) : status === "error" ? (
        <InlineAlert variant="error" actionLabel={onRetry ? "Thử lại" : undefined} onAction={onRetry} className="max-md:[&_button]:min-h-11">
          {error ?? "Chưa tải được lịch sử."}
        </InlineAlert>
      ) : null}
    </div>
  );
}

/** Một cuộc gần đây: tên cắt cuối kèm tooltip khi bị cắt (như hàng của menu lịch sử), giờ bên phải có tooltip ngày giờ. */
function RecentRow({ item, now }: { item: AssistantConversationSummaryDTO; now: Date }) {
  const time = formatConversationTime(item.lastMessageAt, now);
  const titleRef = React.useRef<HTMLSpanElement>(null);
  const [titleCut, setTitleCut] = React.useState(false);
  const measure = () => {
    const el = titleRef.current;
    if (el) setTitleCut(el.scrollWidth > el.clientWidth);
  };
  return (
    <li>
      <Link
        href={`/assistant/${encodeURIComponent(item.id)}`}
        onMouseEnter={measure}
        className={cn(
          // Hàng nằm trên vầng sáng xanh nên hover là lớp trong mờ phủ lên nền, không thay nền: mức theo state layer của
          // Material 3 (rê chuột 8%, nhấn/Tab 10%), sắc theo bậc alpha của Radix Colors (dùng alpha cùng sắc với nền màu bên
          // dưới), nên đậm đều ở giữa lẫn mép vầng sáng mà không ngả xám. Người dùng chê nền xám `accent` (đục màu), lớp trắng
          // trong (không thấy) và thẻ trắng đặc (như thêm một ô nhập) 20/10/2026.
          "flex h-8 items-center gap-3 rounded-md px-4 text-compact text-foreground transition-colors duration-100 max-md:h-11",
          "hover:bg-primary/8 focus-visible:bg-primary/10 active:bg-primary/10",
          focusRingClass,
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span ref={titleRef} className="min-w-0 flex-1 truncate">
              {item.title}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" hidden={!titleCut}>
            {item.title}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{time.short}</span>
          </TooltipTrigger>
          <TooltipContent side="top">{time.full}</TooltipContent>
        </Tooltip>
      </Link>
    </li>
  );
}
