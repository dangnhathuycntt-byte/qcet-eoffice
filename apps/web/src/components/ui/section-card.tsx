import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Một khối của trang chi tiết (cuộc họp, văn bản).
 * - `card` (cột phải): thẻ thuộc tính, viền mảnh bo 10px, tiêu đề 12px đậm (kèm
 *   số đếm mờ) và thao tác nhỏ bên phải, không icon.
 * - `plain` (cột chính, như trang tài liệu của Notion/Granola và trang issue của Linear): không viền, không nền; khối cách
 *   khối trên bằng một đường kẻ mảnh. Tiêu đề là nhãn 12px mờ như "Nội dung và chương trình", để tiêu đề mục 13px đậm bên
 *   trong biên bản không lấn át tiêu đề khối (người dùng chê trang toàn thẻ lồng thẻ, chữ hẹp trong thẻ rộng, 21/10/2026).
 */
export function SectionCard({
  title,
  count,
  action,
  variant = "card",
  children,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  title: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  variant?: "card" | "plain";
}) {
  const plain = variant === "plain";
  return (
    <section className={cn(plain ? "border-t border-border/60 pt-4" : "rounded-sm border-hairline border-border bg-card p-3", className)} {...props}>
      <div className={cn("flex items-center justify-between gap-2", plain ? "mb-1.5 min-h-7" : "mb-2 min-h-6")}>
        <h2 className={cn("flex min-w-0 items-center gap-1.5 text-xs", plain ? "font-medium text-muted-foreground" : "font-semibold text-foreground")}>
          {title}
          {typeof count === "number" ? <span className="font-normal tabular-nums text-muted-foreground">{count}</span> : null}
        </h2>
        {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
