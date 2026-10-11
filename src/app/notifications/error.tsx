"use client";

import * as React from "react";
import { RouteError } from "@/components/ui/route-error";

export default function NotificationsError({
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
      logLabel="Notifications"
      title="Đã xảy ra lỗi khi tải thông báo điều hành"
      fallbackMessage="Không thể tải danh sách thông báo và việc cần xử lý. Vui lòng thử lại hoặc quay về bảng điều khiển."
      backHref="/dashboard"
      backLabel="Bảng điều khiển"
      containerClassName="max-w-3xl mx-auto py-16 px-4"
    />
  );
}
