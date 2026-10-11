"use client";

import * as React from "react";
import { RouteError } from "@/components/ui/route-error";

export default function OrgError({
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
      logLabel="Org"
      title="Đã xảy ra lỗi khi tải cơ cấu tổ chức"
      fallbackMessage="Không thể xử lý sơ đồ bộ máy tổ chức và danh bạ cán bộ. Vui lòng thử lại hoặc quay về bảng điều khiển."
      backHref="/dashboard"
      backLabel="Bảng điều khiển"
    />
  );
}
