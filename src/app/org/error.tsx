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
      title="Đã xảy ra lỗi khi tải Cơ cấu & Danh bạ"
      fallbackMessage="Không thể tải cơ cấu và danh bạ. Vui lòng thử lại hoặc quay về Tổng quan."
      backHref="/"
      backLabel="Tổng quan"
    />
  );
}
