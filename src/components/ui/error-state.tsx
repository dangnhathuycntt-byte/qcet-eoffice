import * as React from "react";
import { FileQuestion, Lock, ServerCrash, WifiOff, Clock } from "lucide-react";
import { EmptyState } from "./empty-state";

export type ErrorStateKind = "not-found" | "forbidden" | "server" | "offline" | "session-expired";

const COPY: Record<ErrorStateKind, { icon: React.ReactNode; title: string; description: string }> = {
  "not-found": {
    icon: <FileQuestion />,
    title: "Không tìm thấy trang",
    description: "Liên kết đã đổi hoặc văn bản đã bị xóa.",
  },
  forbidden: {
    icon: <Lock />,
    title: "Bạn chưa có quyền xem",
    description: "Gửi yêu cầu để người quản lý cấp quyền truy cập.",
  },
  server: {
    icon: <ServerCrash />,
    title: "Hệ thống đang gặp sự cố",
    description: "Lỗi nằm ở phía hệ thống, không phải do bạn. Dữ liệu đang nhập không bị mất.",
  },
  offline: {
    icon: <WifiOff />,
    title: "Mất kết nối mạng",
    description: "Thay đổi được lưu tạm và tự gửi khi có mạng lại.",
  },
  "session-expired": {
    icon: <Clock />,
    title: "Phiên đã hết hạn",
    description: "Đăng nhập lại để tiếp tục. Bản nháp không mất.",
  },
};

export interface ErrorStateProps {
  kind: ErrorStateKind;
  /** Nút hành động, ví dụ "Thử lại" hoặc "Về tổng quan". */
  action?: React.ReactNode;
  /** Số lần thử lại; từ lần thứ 3 trở đi sẽ tự động hiển thị kênh hỗ trợ kỹ thuật theo quy tắc thiết kế. */
  retryCount?: number;
  /** Địa chỉ email / thông tin hỗ trợ kỹ thuật (mặc định: quantrimang@cdktcnqn.edu.vn). */
  supportContact?: string;
  className?: string;
}

/**
 * Trang lỗi và trạng thái hệ thống, nói rõ lỗi của ai và việc nên làm tiếp.
 * Quy tắc thiết kế Components2: Từ lần lỗi thứ 3 trở đi, thêm đường liên hệ hỗ trợ: quantrimang@cdktcnqn.edu.vn
 */
export function ErrorState({
  kind,
  action,
  retryCount = 0,
  supportContact = "quantrimang@cdktcnqn.edu.vn",
  className,
}: ErrorStateProps) {
  const copy = COPY[kind];
  const showSupport = retryCount >= 3;

  const descriptionNode = (
    <div className="flex flex-col gap-2">
      <p>{copy.description}</p>
      {showSupport ? (
        <p className="text-xs text-muted-foreground">
          Đã thử {retryCount} lần không thành công. Vui lòng liên hệ Trung tâm Số và Truyền thông qua{" "}
          <a
            href={`mailto:${supportContact}`}
            className="font-medium text-foreground underline underline-offset-3 hover:text-primary"
          >
            {supportContact}
          </a>
        </p>
      ) : null}
    </div>
  );

  return (
    <EmptyState
      role={kind === "server" || kind === "offline" ? "alert" : undefined}
      icon={copy.icon}
      title={copy.title}
      description={descriptionNode as any}
      action={action}
      className={className}
    />
  );
}
