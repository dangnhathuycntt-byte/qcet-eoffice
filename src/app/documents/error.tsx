"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentLoadError } from "@/components/documents/document-load-error";

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

  return (
    <div className="max-w-[1440px] w-full mx-auto py-12 px-4">
      <DocumentLoadError
        title="Đã xảy ra lỗi khi tải phân hệ văn bản"
        message="Không thể xử lý sổ quản lý văn bản & công văn. Vui lòng thử lại hoặc quay về bảng điều khiển."
        digest={error?.digest}
        onRetry={reset}
      >
        <Button type="button" variant="secondary" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft strokeWidth={1.5} />
            Bảng điều khiển
          </Link>
        </Button>
      </DocumentLoadError>
    </div>
  );
}
