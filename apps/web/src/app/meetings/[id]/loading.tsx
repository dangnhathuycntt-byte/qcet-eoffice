import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Khung chờ của chi tiết cuộc họp: cùng khung một thẻ với trang thật (thanh đầu 40px, tên, cột thuộc tính 340px). Không có
 * tệp này thì `meetings/loading.tsx` (khung danh sách) hiện khi mở một cuộc họp.
 */
export default function MeetingDetailLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col animate-pulse" role="status" aria-label="Đang tải cuộc họp…">
      <div className="grid min-h-0 flex-1 p-2 max-md:p-0">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card max-md:rounded-none max-md:border-0">
          <div className="flex h-10 items-center justify-between border-b border-border/40 px-[18px] max-md:h-11 max-md:px-4">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-7 w-28 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 gap-8 px-4 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-6 lg:pl-6 lg:pr-0 min-[90rem]:pl-12">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="mt-3 h-3 w-32" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="mt-4 h-40 w-full rounded-[10px]" />
            </div>
            <div className="flex flex-col gap-2 px-2 max-lg:hidden">
              <Skeleton className="h-48 w-full rounded-[10px]" />
              <Skeleton className="h-28 w-full rounded-[10px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
