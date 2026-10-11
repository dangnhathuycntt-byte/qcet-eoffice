"use client";

import { RouteError } from "@/components/ui/route-error";

export default function TasksError({
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
      logLabel="Tasks"
      title="Đã xảy ra lỗi khi tải trang nhiệm vụ"
      fallbackMessage="Không thể xử lý giao diện quản lý nhiệm vụ. Vui lòng thử lại hoặc quay về bảng điều khiển."
      backHref="/dashboard"
      backLabel="Bảng điều khiển"
    />
  );
}
