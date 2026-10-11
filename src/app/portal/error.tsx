"use client";

import * as React from "react";
import { RouteError } from "@/components/ui/route-error";

export default function PortalError({
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
      logLabel="Portal"
      title="Đã xảy ra lỗi khi tải Cổng Lãnh đạo"
      fallbackMessage="Không thể tải dữ liệu điều hành. Vui lòng thử lại hoặc quay về bàn làm việc."
      backHref="/dashboard"
      backLabel="Bàn làm việc"
    />
  );
}
