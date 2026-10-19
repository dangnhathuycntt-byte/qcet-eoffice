"use client";

import * as React from "react";
import { RouteError } from "@/components/ui/route-error";

export default function AssistantError({
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
      logLabel="Assistant"
      title="Đã xảy ra lỗi khi mở Trợ lý"
      fallbackMessage="Không thể tải trang Trợ lý. Vui lòng thử lại hoặc quay về tổng quan."
      backHref="/"
      backLabel="Tổng quan"
    />
  );
}
