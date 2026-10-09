"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentLoadError } from "@/components/documents/document-load-error";

export default function OutgoingDocumentDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("OutgoingDocumentDetail error:", error);
  }, [error]);

  return (
    <div className="max-w-[1440px] w-full mx-auto py-12 px-4">
      <DocumentLoadError
        title="Không thể tải chi tiết văn bản đi"
        message="Đã xảy ra lỗi khi tải thông tin văn bản. Vui lòng thử lại hoặc quay về danh sách."
        digest={error?.digest}
        onRetry={reset}
      >
        <Button type="button" variant="secondary" size="sm" asChild>
          <Link href="/documents">
            <ArrowLeft strokeWidth={1.5} />
            Về danh sách văn bản
          </Link>
        </Button>
      </DocumentLoadError>
    </div>
  );
}
