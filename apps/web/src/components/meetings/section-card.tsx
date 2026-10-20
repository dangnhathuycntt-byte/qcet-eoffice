import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Thẻ một khối của trang chi tiết cuộc họp, cùng kiểu thẻ "Thuộc tính"/"Việc con" của chi tiết nhiệm vụ: viền mảnh bo 10px,
 * tiêu đề 12px đậm (kèm số đếm mờ) và thao tác nhỏ bên phải, không icon.
 */
export function SectionCard({
  title,
  count,
  action,
  children,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  title: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-[10px] border border-border bg-card p-3", className)} {...props}>
      <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
          {title}
          {typeof count === "number" ? <span className="font-normal tabular-nums text-muted-foreground">{count}</span> : null}
        </h2>
        {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
