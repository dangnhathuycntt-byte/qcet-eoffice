import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Khung chờ của danh sách Cuộc họp: cùng khung thẻ một trang (`WorkspacePageCard`), thanh tab và vài hàng 48px. */
export default function MeetingsLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-2 max-md:p-0 animate-pulse" role="status" aria-label="Đang tải danh sách cuộc họp…">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card max-md:rounded-none max-md:border-0">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
          <Skeleton className="h-7 w-64 rounded-full" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
