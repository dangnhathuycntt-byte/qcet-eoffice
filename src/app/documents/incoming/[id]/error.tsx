"use client";

import { DocumentLoadError } from "@/components/documents/document-load-error";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <DocumentLoadError
        title="Không thể tải chi tiết văn bản đến"
        message="Không thể tải dữ liệu. Vui lòng thử lại."
        onRetry={reset}
      />
    </div>
  );
}
