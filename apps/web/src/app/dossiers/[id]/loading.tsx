import { Skeleton } from "@/components/ui/skeleton";

/** Khung chờ chi tiết hồ sơ theo hình trang thật: liên kết quay lại, thẻ đầu (icon, tên, mã + nhãn), cột chính và cột phụ. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6" role="status" aria-busy="true" aria-label="Đang tải hồ sơ">
      <Skeleton className="h-3.5 w-28 rounded" />
      <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-5">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-2/3 rounded" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-40 rounded" />
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
