import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Khung chờ của Full Page: cùng bố cục (đầu trang gọn + vùng xem tệp) để không nhảy khi dữ liệu về. */
export function DocumentFullPageSkeleton({ label }: { label: string }) {
  return (
    <div className="flex w-full flex-col motion-safe:animate-pulse" role="status" aria-busy="true" aria-label={label}>
      <div className="flex h-8 items-center gap-1.5 px-4 sm:px-6">
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="flex min-h-[480px] flex-col lg:h-[calc(100dvh-7rem)]">
        <div className="space-y-2 px-4 pb-3 pt-1 sm:px-6">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-3.5 w-1/2 max-w-md" />
        </div>
        <div className="flex-1 border-t border-border/50 bg-muted/50" />
      </div>
    </div>
  );
}
