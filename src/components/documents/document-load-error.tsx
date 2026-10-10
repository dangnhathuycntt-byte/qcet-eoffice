import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export interface DocumentLoadErrorProps {
  title: string;
  message?: string | null;
  /** Mã yêu cầu của Next.js, chỉ hiện khi có. */
  digest?: string;
  onRetry?: () => void;
  /** Nút phụ cạnh "Thử lại", ví dụ liên kết về danh sách. */
  children?: React.ReactNode;
  className?: string;
}

/** Lỗi tải dữ liệu phân hệ Văn bản: dùng chung cho sổ, thẻ điện thoại và các route lỗi. */
export function DocumentLoadError({ title, message, digest, onRetry, children, className }: DocumentLoadErrorProps) {
  return (
    <EmptyState
      role="alert"
      density="compact"
      icon={<AlertCircle strokeWidth={1.5} />}
      title={title}
      description={
        <>
          {message}
          {digest ? <span className="mt-1 block font-mono text-xs">Mã yêu cầu: {digest}</span> : null}
        </>
      }
      action={
        onRetry || children ? (
          <div className="flex items-center justify-center gap-2">
            {onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw strokeWidth={1.5} />
                Thử lại
              </Button>
            ) : null}
            {children}
          </div>
        ) : null
      }
      className={className}
    />
  );
}
