"use client";

import * as React from "react";
import { RouteError } from "@/components/ui/route-error";

export default function MeetingsError({
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
      logLabel="Meetings"
      title="Đã xảy ra lỗi khi tải danh sách cuộc họp"
      fallbackMessage="Không thể tải cuộc họp. Vui lòng thử lại hoặc quay về Nhiệm vụ."
      backHref="/tasks"
      backLabel="Nhiệm vụ"
    />
  );
}
