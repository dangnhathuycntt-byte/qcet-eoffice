"use client";

import { RouteError } from "@/components/ui/route-error";

export default function SettingsError({
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
      logLabel="Settings"
      title="Đã xảy ra lỗi khi tải Cài đặt"
      fallbackMessage="Không thể tải trang cài đặt hệ thống. Vui lòng thử lại hoặc quay về bàn làm việc."
      backHref="/dashboard"
      backLabel="Bàn làm việc"
    />
  );
}
