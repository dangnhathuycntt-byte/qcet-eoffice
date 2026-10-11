"use client";

import { RouteError } from "@/components/ui/route-error";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      logLabel="Dashboard"
      title="Đã xảy ra lỗi khi tải Bảng điều hành"
      fallbackMessage="Không thể xử lý dữ liệu bảng điều hành tổng thể. Vui lòng thử lại hoặc tải lại trang."
      backHref="/tasks"
      backLabel="Nhiệm vụ"
    />
  );
}
