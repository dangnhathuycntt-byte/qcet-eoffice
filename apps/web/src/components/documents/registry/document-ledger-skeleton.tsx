import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Khung chờ của sổ văn bản khi route đang tải, dựng trong cùng thẻ bo tròn với `DocumentRegistryView` (giá trị khung lấy từ
 * `SPLIT_WORKSPACE`/`WORKSPACE_CARD` ở đó) để lúc dữ liệu về trang không nhảy khung:
 * desktop (sm+) = thanh công cụ + tiêu đề cột 32px + hàng một dòng 40px như `DocumentLedgerTable`;
 * điện thoại = header hai hàng 44px (menu, tiêu đề, + rồi nhóm, tìm, lọc) và hàng hai dòng như `DocumentCardList`. Không số liệu giả.
 */
export function DocumentRegistrySkeleton({ rows = 10, cards = 8 }: { rows?: number; cards?: number }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col" role="status" aria-busy="true" aria-label="Đang tải sổ văn bản" data-slot="document-registry-skeleton">
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-1.5 p-2 max-md:gap-0 max-md:p-0">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card motion-safe:animate-pulse max-md:rounded-none max-md:border-0">
          {/* Desktop */}
          <div className="hidden sm:block">
            <div className="flex h-[46px] items-center gap-1.5 border-b border-border/60 px-6">
              <Skeleton className="h-3.5 w-24 rounded" />
              <span className="flex-1" />
              <Skeleton className="h-7 w-44 rounded-full" />
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="size-7 rounded-full" />
            </div>
            <div className="px-4 pt-4">
              <div className="flex h-8 items-center gap-2 px-2 md:pl-6 md:pr-5">
                <Skeleton className="size-3.5 rounded-[4px]" />
                <Skeleton className="h-3 w-14 rounded" />
              </div>
              {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex h-10 items-center gap-2 px-2 md:pl-6 md:pr-5">
                  <Skeleton className="size-3.5 shrink-0 rounded-[4px]" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-3 rounded" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
                  </div>
                  <Skeleton className="hidden h-3 w-20 shrink-0 rounded xl:block" />
                  <Skeleton className="hidden h-3 w-28 shrink-0 rounded xl:block" />
                  <Skeleton className="h-3 w-16 shrink-0 rounded" />
                  <Skeleton className="h-3 w-20 shrink-0 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Điện thoại */}
          <div className="sm:hidden">
            <div className="flex h-11 items-center gap-2 border-b border-border/60 px-4">
              <Skeleton className="size-5" />
              <Skeleton className="h-4 w-28" />
              <span className="flex-1" />
              <Skeleton className="size-7 rounded-full" />
            </div>
            <div className="flex h-11 items-center gap-2 px-4">
              <Skeleton className="h-7 w-20 rounded-full" />
              <span className="flex-1" />
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="size-7 rounded-full" />
            </div>
            {Array.from({ length: cards }).map((_, i) => (
              <div key={i} className="mx-2 flex min-h-[52px] items-start gap-3 px-2 py-2">
                <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                  <div className="flex justify-between gap-3">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
