"use client";

import * as React from "react";
import { RouteError } from "@/components/ui/route-error";

export default function CalendarError({
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
      logLabel="Calendar"
      title="Đã xảy ra lỗi khi tải lịch công tác"
      fallbackMessage="Không thể xử lý lịch trình công tác và sự kiện. Vui lòng thử lại hoặc quay về Nhiệm vụ."
      backHref="/tasks"
      backLabel="Nhiệm vụ"
    />
  );
}
