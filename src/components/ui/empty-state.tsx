import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Nút hành động tiếp theo, ví dụ "Tạo nhiệm vụ" hoặc "Xóa bộ lọc". */
  action?: React.ReactNode;
  /** compact: chữ 13px/12px và khoảng cách gọn cho khung trong bảng hoặc panel hẹp. Mặc định giữ nguyên. */
  density?: "default" | "compact";
}

/** Trạng thái không có dữ liệu: nói rõ vì sao trống và việc nên làm tiếp. */
export function EmptyState({ icon, title, description, action, density = "default", className, ...props }: EmptyStateProps) {
  const compact = density === "compact";
  return (
    <div
      data-density={density}
      className={cn(
        compact ? "flex flex-col items-center gap-1.5 px-4 py-8 text-center" : "flex flex-col items-center gap-3 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <div className="max-w-sm">
        <p className={cn("font-medium text-foreground", compact ? "text-compact" : "text-base")}>{title}</p>
        {description ? <div className={cn("text-muted-foreground", compact ? "mt-0.5 text-xs" : "mt-1 text-sm")}>{description}</div> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
