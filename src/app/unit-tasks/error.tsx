"use client";

import * as React from "react";
import { RouteError } from "@/components/ui/route-error";

export default function UnitTasksError({
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
      logLabel="UnitTasks"
      title="Đã xảy ra lỗi khi tải trang nhiệm vụ đơn vị"
      fallbackMessage="Không thể xử lý giao diện quản lý nhiệm vụ đơn vị. Vui lòng thử lại hoặc quay về bảng điều khiển."
      backHref="/dashboard"
      backLabel="Bảng điều khiển"
    />
  );
}
