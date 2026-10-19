"use client";

import * as React from "react";
import { RouteError } from "@/components/ui/route-error";

export default function InboxError({
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
      logLabel="Inbox"
      title="Đã xảy ra lỗi khi tải Hộp thư"
      fallbackMessage="Không thể tải danh sách nhiệm vụ cần xử lý. Vui lòng thử lại hoặc quay về Nhiệm vụ."
      backHref="/tasks"
      backLabel="Nhiệm vụ"
    />
  );
}
