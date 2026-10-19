"use client";

import * as React from "react";
import { RouteError } from "@/components/ui/route-error";

export default function DossierError({
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
      logLabel="Dossier"
      title="Không thể tải hồ sơ"
      fallbackMessage="Không thể tải dữ liệu hồ sơ. Vui lòng thử lại hoặc quay về Hồ sơ công việc."
      backHref="/dossiers"
      backLabel="Hồ sơ công việc"
    />
  );
}
