import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Nhấp nháy nhẹ (tắt khi người dùng bật giảm chuyển động). Mặc định tắt. */
  pulse?: boolean;
}

/**
 * Khối giữ chỗ khi dữ liệu đang tải. Chỉ trang trí nên ẩn khỏi trình đọc màn hình;
 * vùng chứa nên đặt `aria-busy` và có thông báo trạng thái riêng.
 */
function Skeleton({ className, pulse = false, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn(
        "rounded-lg bg-secondary",
        pulse && "motion-safe:animate-pulse",
        className,
      )}
      {...props}
    />
  );
}

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

/** Đoạn văn giữ chỗ; dòng cuối ngắn hơn để giống văn bản thật. */
function SkeletonText({ lines = 3, className, ...props }: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2", className)} {...props}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText };
