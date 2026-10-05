import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Nút hành động tiếp theo, ví dụ "Tạo nhiệm vụ" hoặc "Xóa bộ lọc". */
  action?: React.ReactNode;
}

/** Trạng thái không có dữ liệu: nói rõ vì sao trống và việc nên làm tiếp. */
export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}
      {...props}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <div className="max-w-sm">
        <p className="text-base font-medium text-foreground">{title}</p>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
