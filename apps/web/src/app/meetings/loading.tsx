import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Khung chờ của danh sách Cuộc họp: cùng khung trang danh sách như Nhiệm vụ (thanh tiêu đề 44px, hàng tab, hàng 48px). */
export default function MeetingsLoading() {
  return (
    <div className="flex flex-col animate-pulse" role="status" aria-label="Đang tải danh sách cuộc họp…">
      <div className="-mx-4 flex h-11 items-center justify-between gap-3 border-b border-border/60 px-4 md:-mx-[18px] md:px-[18px]">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-7 w-28 rounded-full max-md:w-8" />
      </div>
      <div className="flex h-11 items-center justify-between gap-3">
        <Skeleton className="h-7 w-56 rounded-full" />
        <Skeleton className="size-7 rounded-full" />
      </div>
      <div className="flex flex-col pt-8">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex h-12 items-center gap-6 px-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3.5 w-1/6" />
            <Skeleton className="h-3.5 w-1/6 max-md:hidden" />
          </div>
        ))}
      </div>
    </div>
  );
}
