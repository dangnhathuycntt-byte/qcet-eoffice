"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentLoadError } from "@/components/documents/document-load-error";
import { CHUNK_ERROR_MESSAGE, useChunkLoadRecovery } from "@/lib/chunk-load-recovery";

export default function DocumentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Documents error boundary caught error:", error);
  }, [error]);

  // Trình xem tệp nạp chunk riêng: lỗi chunk thì tự tải lại một lần, nút đổi thành tải lại cả trang
  const isChunkError = useChunkLoadRecovery(error);

  return (
    <div className="max-w-[1440px] w-full mx-auto py-12 px-4">
      <DocumentLoadError
        title="Đã xảy ra lỗi khi tải phân hệ văn bản"
        message={isChunkError ? CHUNK_ERROR_MESSAGE : "Không thể xử lý sổ quản lý văn bản & công văn. Vui lòng thử lại hoặc quay về Nhiệm vụ."}
        digest={error?.digest}
        onRetry={isChunkError ? () => window.location.reload() : reset}
        retryLabel={isChunkError ? "Tải lại trang" : undefined}
      >
        <Button variant="secondary" size="sm" asChild>
          <Link href="/tasks">
            <ArrowLeft />
            Nhiệm vụ
          </Link>
        </Button>
      </DocumentLoadError>
    </div>
  );
}
