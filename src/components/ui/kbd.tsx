import * as React from "react";
import { cn } from "@/lib/utils";

/** Một phím trong gợi ý phím tắt. Dùng thẻ `<kbd>` để trình đọc màn hình hiểu đây là phím. */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-secondary px-1.5 font-mono text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Tổ hợp nhiều phím, ví dụ Ctrl + Enter. Ký hiệu "+" chỉ để trang trí. */
export function KbdGroup({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  const items = React.Children.toArray(children);
  return (
    <span className={cn("inline-flex items-center gap-1", className)} {...props}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 ? (
            <span aria-hidden="true" className="text-xs text-muted-foreground">
              +
            </span>
          ) : null}
          {child}
        </React.Fragment>
      ))}
    </span>
  );
}
