import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Độ dài vạch tên lần lượt từng hàng: dài ngắn khác nhau như tên thật, cố định để không nhảy giữa các lần vẽ. */
const TITLE_WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-2/3", "w-1/3", "w-3/4"];

/**
 * Hàng giữ chỗ của danh sách cuộc trò chuyện (menu lịch sử ở thanh đầu và thanh dưới, cuộc gần đây ở màn đầu): vạch
 * tên và vạch giờ bên phải, cùng chiều cao và lề với hàng thật, như skeleton của Tổng quan và sổ Văn bản; không phải
 * khối xám kín cả hàng.
 */
export function ConversationRowsSkeleton({
  count,
  rowClassName,
  withTime = false,
  className,
}: {
  count: number;
  /** Chiều cao và lề ngang của hàng thật. */
  rowClassName: string;
  /** Hàng thật có giờ ở bên phải. */
  withTime?: boolean;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={cn("flex flex-col gap-px", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden="true" className={cn("flex items-center gap-3", rowClassName)}>
          <Skeleton className={cn("h-3", TITLE_WIDTHS[i % TITLE_WIDTHS.length])} />
          {withTime ? <Skeleton className="ml-auto h-2.5 w-8 shrink-0" /> : null}
        </div>
      ))}
    </div>
  );
}
