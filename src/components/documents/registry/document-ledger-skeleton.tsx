import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Khung chờ của sổ văn bản, khớp hai bố cục thật của `DocumentRegistryView`:
 * desktop (sm+) = thanh công cụ 40px + tiêu đề cột 40px + hàng hai dòng 56px (`DocumentLedgerTable`);
 * điện thoại = tiêu đề, ô tìm kiếm riêng 44px và thẻ (`DocumentCardList`). Không dựng thẻ thống kê, không số liệu giả.
 */
export function DocumentRegistrySkeleton({ rows = 8, cards = 4 }: { rows?: number; cards?: number }) {
  return (
    <div className="w-full pb-6 md:pb-10" role="status" aria-busy="true" aria-label="Đang tải sổ văn bản" data-slot="document-registry-skeleton">
      {/* Desktop */}
      <div className="hidden sm:block">
        <div className="flex h-10 items-center gap-2">
          <Skeleton className="h-4 w-28" />
          <span className="flex-1" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="mt-2 motion-safe:animate-pulse">
          <div className="flex h-10 items-center px-3">
            <Skeleton className="h-3 w-1/4" />
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex min-h-14 flex-col justify-center gap-1.5 px-3 py-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          ))}
        </div>
      </div>

      {/* Điện thoại */}
      <div className="sm:hidden">
        <div className="flex flex-wrap items-center gap-2 min-h-10">
          <Skeleton className="h-4 w-28" />
          <span className="flex-1" />
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="mt-2 space-y-3 motion-safe:animate-pulse">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="space-y-2.5 rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex justify-end gap-2 border-t border-border/40 pt-1">
                <Skeleton className="h-11 w-20" />
                <Skeleton className="h-11 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
